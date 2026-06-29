// TEMPLE GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS & BOARD STRUCTURE
// ============================================

const SVG_NS = "http://www.w3.org/2000/svg";

// ---- 2-PLAYER BOARD (classic vertical hexagon) ----
// Logical columns 0-4; x = 50 + (col-2)*13, y = 5 + row*13
const BOARD_STRUCTURE_2 = [
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

// ---- 4-PLAYER BOARD (Greek cross / plus) ----
// Four tapered arms (each 5+3+1) around a free 5x5 centre. Rows/cols 2-12, centre at (7,7).
// Each row is a contiguous column range; arms point up/down/left/right to an Artemis tip.
const BOARD_STRUCTURE_4 = [
    { row: 2,  count: 1,  offset: 7 },
    { row: 3,  count: 3,  offset: 6 },
    { row: 4,  count: 5,  offset: 5 },
    { row: 5,  count: 7,  offset: 4 },
    { row: 6,  count: 9,  offset: 3 },
    { row: 7,  count: 11, offset: 2 },
    { row: 8,  count: 9,  offset: 3 },
    { row: 9,  count: 7,  offset: 4 },
    { row: 10, count: 5,  offset: 5 },
    { row: 11, count: 3,  offset: 6 },
    { row: 12, count: 1,  offset: 7 }
];

let numPlayers = 2;
let BOARD_STRUCTURE = BOARD_STRUCTURE_2;

// Clockwise order copied from Pyramid: white(bottom) -> red(left) -> black(top) -> blue(right)
const PLAYERS_4 = ['white', 'red', 'black', 'blue'];
let turnIndex = 0;

// Per-colour movement axis + the Artemis tip each races toward (set in configureBoard).
// dir: 'up'|'down'|'left'|'right' (forward direction). target: {row,col} of the goal tip.
let PLAYER_CONFIG = {};

function activeColors() {
    return numPlayers === 4 ? PLAYERS_4 : ['white', 'black'];
}

// Compute node pixel coords for the current board.
function nodeXY(row, col) {
    if (numPlayers === 4) {
        return { x: 70 + (col - 7) * 12, y: 70 + (row - 7) * 12 };
    }
    return { x: 50 + (col - 2) * 13, y: 5 + row * 13 };
}

function configureBoard() {
    if (numPlayers === 4) {
        BOARD_STRUCTURE = BOARD_STRUCTURE_4;
        PLAYER_CONFIG = {
            white: { dir: 'up', target: { row: 2, col: 7 } },     // bottom -> top tip
            black: { dir: 'down', target: { row: 12, col: 7 } },  // top -> bottom tip
            red: { dir: 'right', target: { row: 7, col: 12 } },   // left -> right tip
            blue: { dir: 'left', target: { row: 7, col: 2 } }     // right -> left tip
        };
    } else {
        BOARD_STRUCTURE = BOARD_STRUCTURE_2;
        PLAYER_CONFIG = {
            white: { dir: 'up', target: { row: 0, col: 2 } },
            black: { dir: 'down', target: { row: 8, col: 2 } }
        };
    }
}

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
let isVsComputer = localStorage.getItem('templeVsComputer') === null ? true : localStorage.getItem('templeVsComputer') === 'true';
let computerDifficulty = localStorage.getItem('templeDifficulty') || 'medium';
let isAnimating = false; // Global flag to block all interaction during stone movement
let moveHistory = []; // Track path directions for leap chaining constraint

// Track AI behavior to prevent loops
let aiLastMovedStone = null; // {row, col}
let aiConsecutiveMoveCount = 0;

// ============================================
// DOM ELEMENTS
// ============================================
const svg = document.getElementById('game-board');
const messageBox = document.getElementById('message-box');
const resetButton = document.getElementById('reset-button');
const opponentButton = document.getElementById('opponent-btn');
const cancelButton = document.getElementById('cancel-button');
const gameOverModal = document.getElementById('game-over-modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const statusElement = document.getElementById('status-text') || { textContent: '' };
const playerColorElement = document.getElementById('player-color') || { style: {} };

// ============================================
// BOARD INITIALIZATION
// ============================================

function initializeBoard() {
    configureBoard();
    if (svg && svg.setAttribute) {
        svg.setAttribute('viewBox', numPlayers === 4 ? '0 0 140 140' : '0 0 100 120');
    }
    board.clear();
    connections.clear();

    // Artemis tips are the goal nodes (2 for 2p, 4 for 4p)
    const tipSet = new Set(Object.values(PLAYER_CONFIG).map(p => `${p.target.row},${p.target.col}`));
    const rowLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];

    BOARD_STRUCTURE.forEach(({ row, count, offset }) => {
        for (let i = 0; i < count; i++) {
            const col = offset + i;
            const { x, y } = nodeXY(row, col);
            const key = `${row},${col}`;
            const isArtemis = tipSet.has(key);
            const label = `${rowLabels[row]}${i + 1}`;

            board.set(key, { row, col, x, y, piece: null, isArtemis, label });
        }
    });

    buildConnections();
    placeStartingPieces();

    turnIndex = 0;
    currentPlayer = activeColors()[0];
    selectedStone = null;
    validMoves = [];
    gameState = 'SELECT_STONE';
    isInLeapChain = false;
    moveHistory = [];
    leapChainStart = null;
    isAnimating = false; // Ensure no stale animation locks remain

    drawBoard();
    if (window.is3DView && window.rebuild3DBoard) window.rebuild3DBoard();
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

    // 4-player Greek cross: same connection pattern as the 2-player board —
    // orthogonal everywhere, plus diagonals ONLY between even-parity cells (row+col even).
    // (Adding diagonals from even cells to their down-diagonal neighbours covers each
    //  diagonal edge once and reproduces the sparse, navigable mesh — not an X per cell.)
    if (numPlayers === 4) {
        const link = (r1, c1, r2, c2) => {
            const k1 = `${r1},${c1}`, k2 = `${r2},${c2}`;
            if (board.has(k1) && board.has(k2)) {
                connections.get(k1).push({ row: r2, col: c2 });
                connections.get(k2).push({ row: r1, col: c1 });
            }
        };
        board.forEach((node) => {
            const { row, col } = node;
            link(row, col, row, col + 1); // right
            link(row, col, row + 1, col); // down
            if ((row + col) % 2 === 0) {  // diagonals from even-parity cells only
                link(row, col, row + 1, col + 1); // down-right
                link(row, col, row + 1, col - 1); // down-left
            }
        });
        return;
    }

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

// Which arm (start zone / owner) a node belongs to in the 4-player cross.
// rows 2-4 = black (top), rows 10-12 = white (bottom), cols 2-4 = red (left),
// cols 10-12 = blue (right), otherwise the free 5x5 centre.
function zone4(row, col) {
    if (row >= 2 && row <= 4) return 'black';
    if (row >= 10 && row <= 12) return 'white';
    if (col >= 2 && col <= 4) return 'red';
    if (col >= 10 && col <= 12) return 'blue';
    return null;
}

function placeStartingPieces() {
    if (numPlayers === 4) {
        board.forEach((node) => {
            const owner = zone4(node.row, node.col);
            if (owner) node.piece = owner;
        });
        return;
    }
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
    if (window.is3DView && window.update3DViews) window.update3DViews();
}

function updateStatus(message = null) {
    const COLOR_HEX = { white: '#ffffff', black: '#1a1a1a', red: '#c0392b', blue: '#2a6fdb' };
    playerColorElement.style.backgroundColor = COLOR_HEX[currentPlayer] || '#1a1a1a';
    playerColorElement.style.borderColor = currentPlayer === 'white' ? '#1a1a1a' : '#ffffff';

    // Sync the side-menu stone counts
    if (typeof countStonesByColor === 'function') {
        const counts = countStonesByColor();
        ['white', 'black', 'red', 'blue'].forEach(c => {
            const el = document.getElementById(`${c}-count-menu`);
            if (el) el.textContent = counts[c];
        });
    }

    if (gameState === 'GAME_OVER') return;

    if (message) {
        statusElement.textContent = message;
    } else {
        const playerName = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1);
        if (gameState === 'SELECT_STONE') {
            statusElement.textContent = `${playerName}'S TURN`;
        } else if (gameState === 'SELECT_MOVE') {
            if (isInLeapChain) {
                statusElement.textContent = `KEEP LEAPING OR CLICK STOP`;
            } else {
                statusElement.textContent = `CHOOSE DESTINATION`;
            }
        }
    }
}

function showMessage(text) {
    // Disabled as per user request to remove text spam
}

function hideMessage() {
    // Disabled
}

function updateUI() {
    if (selectedStone && !isAITurn()) {
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

function isForwardOrSideways(fromRow, fromCol, toRow, toCol, player) {
    // Each player advances toward their target Artemis tip; sideways allowed, backward not.
    const dir = (PLAYER_CONFIG[player] && PLAYER_CONFIG[player].dir) || 'up';
    if (dir === 'up') return toRow <= fromRow;     // white: decreasing row
    if (dir === 'down') return toRow >= fromRow;   // black: increasing row
    if (dir === 'right') return toCol >= fromCol;  // red: increasing col
    if (dir === 'left') return toCol <= fromCol;   // blue: decreasing col
    return true;
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
        if (targetNode && !targetNode.piece && isForwardOrSideways(row, col, conn.row, conn.col, player)) {
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
                    if (beyondNode && !beyondNode.piece && isForwardOrSideways(row, col, beyond.row, beyond.col, player)) {
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
                if (!isForwardOrSideways(row, col, conn.row, conn.col, player)) {
                    return; // Skip backward Leap of Faith
                }

                moves.push({
                    row: offBoardRow,
                    col: offBoardCol,
                    type: 'leap', // Unified as leap
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
    // Block ALL clicks if any animation is in progress
    if (isAnimating) return;

    // If VS Computer, block all clicks during an AI player's turn
    if (isAITurn()) {
        return;
    }
    
    // Also block clicking opponent stones during human turn in SELECT_STONE phase
    const key = `${row},${col}`;
    const node = board.get(key);
    if (gameState === 'SELECT_STONE' && node.piece && node.piece !== currentPlayer && isVsComputer) {
        return;
    }

    if (gameState === 'GAME_OVER') {
        showMessage("Game Over! Click New Game to play again.");
        return;
    }

    if (gameState === 'SELECT_STONE') {
        if (node.piece === currentPlayer) {
            selectedStone = { row, col };
            const walkMoves = calculateWalkMoves(row, col);
            const leapMoves = calculateLeapMoves(row, col);
            validMoves = [...walkMoves, ...leapMoves];

            if (validMoves.length === 0) {
                // Self-evident to player, no prompt needed.
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
        } else if (node.piece === currentPlayer) {
            if (isInLeapChain) {
                if (selectedStone && selectedStone.row === row && selectedStone.col === col) {
                    endTurn();
                }
            } else {
                if (selectedStone && selectedStone.row === row && selectedStone.col === col) {
                    // Deselect
                    selectedStone = null;
                    validMoves = [];
                    gameState = 'SELECT_STONE';
                } else {
                    // Reselect different stone
                    selectedStone = { row, col };
                    const walkMoves = calculateWalkMoves(row, col);
                    const leapMoves = calculateLeapMoves(row, col);
                    validMoves = [...walkMoves, ...leapMoves];

                    if (validMoves.length === 0) {
                        selectedStone = null;
                        gameState = 'SELECT_STONE';
                        updateBoardDisplay();
                        return;
                    }
                }

                drawBoard();
                updateStatus();
                if (window.is3DView && window.update3DHighlights) window.update3DHighlights();
            }
        }
    }
}


// Leap of Faith logic is now integrated into executeMove


function executeMove(move) {
    const fromKey = `${selectedStone.row},${selectedStone.col}`;
    const fromNode = board.get(fromKey);
    if (!fromNode) return;

    const originalStone = { row: selectedStone.row, col: selectedStone.col };
    const leapingPlayer = fromNode.piece;

    // Track AI consecutive moves (not during leap chains)
    if (isAITurn() && !isInLeapChain) {
        if (aiLastMovedStone && aiLastMovedStone.row === selectedStone.row && aiLastMovedStone.col === selectedStone.col) {
            aiConsecutiveMoveCount++;
        } else {
            aiConsecutiveMoveCount = 1;
        }
        aiLastMovedStone = { row: move.row, col: move.col };
    } else if (!isAITurn()) {
        aiLastMovedStone = null;
        aiConsecutiveMoveCount = 0;
    } else {
        aiLastMovedStone = { row: move.row, col: move.col };
    }

    const finalizeMove = () => {
        isAnimating = false;
        
        // Remove jumper from its origin
        fromNode.piece = null;

        if (move.offBoard) {
            // Remove captured piece
            if (move.over) {
                const overNode = board.get(`${move.over.row},${move.over.col}`);
                if (overNode) overNode.piece = null;
            }
            showMessage("A Leap of Faith was performed!");
            endTurn();
        } else {
            // Place jumper piece at destination
            const toNode = board.get(`${move.row},${move.col}`);
            if (toNode) toNode.piece = leapingPlayer;

            // Remove captured piece
            if (move.capture && move.over) {
                const overNode = board.get(`${move.over.row},${move.over.col}`);
                if (overNode) overNode.piece = null;
            }

            // Check for victory: reaching one's own target Artemis tip (the opposite end)
            const tgt = PLAYER_CONFIG[leapingPlayer] && PLAYER_CONFIG[leapingPlayer].target;
            if (toNode && tgt && toNode.row === tgt.row && toNode.col === tgt.col) {
                gameState = 'GAME_OVER';
                const winnerText = leapingPlayer.charAt(0).toUpperCase() + leapingPlayer.slice(1);
                showGameOverModal(`${winnerText} Wins!`, `${winnerText} reached the Artemis field!`);
                endTurn();
                return;
            }

            // Record in history for directional constraint
            moveHistory.push(move);

            // Chaining logic
            if (move.type === 'leap') {
                if (!isInLeapChain) {
                    isInLeapChain = true;
                    leapChainStart = originalStone;
                }
                selectedStone = { row: move.row, col: move.col };
                const nextLeaps = calculateLeapMoves(move.row, move.col, true, move.direction);

                if (nextLeaps.length > 0) {
                    validMoves = nextLeaps;
                    drawBoard();
                    updateStatus();
                    updateUI();
                    if (isAITurn()) {
                        setTimeout(makeAIMove, 600);
                    }
                    return;
                }
            }

            endTurn();
        }
    };

    if (window.is3DView && window.animate3DMove) {
        isAnimating = true;
        window.animate3DMove(originalStone.row, originalStone.col, move.row, move.col, finalizeMove);
    } else {
        finalizeMove();
    }
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
    isAnimating = false; // Reset animation flag on turn end just in case
    
    // Advance to the next player who still has stones (clockwise; skip the eliminated)
    const counts = countStonesByColor();
    const order = activeColors();
    for (let i = 0; i < order.length; i++) {
        turnIndex = (turnIndex + 1) % order.length;
        if (counts[order[turnIndex]] > 0) break;
    }
    currentPlayer = order[turnIndex];
    gameState = 'SELECT_STONE';
    moveHistory = [];

    drawBoard();
    if (window.is3DView) {
        // Force complete rebuild if we suspect desync
        if (window.rebuild3DBoard) window.rebuild3DBoard();
        else if (window.sync3D) window.sync3D(true);
        if (window.update3DViews) window.update3DViews();
    }

    updateStatus();
    updateUI();

    // Win check: only one player with stones left (others eliminated)
    const survivors = order.filter(c => counts[c] > 0);
    if (survivors.length <= 1) {
        const winner = survivors[0] || currentPlayer;
        gameState = 'GAME_OVER';
        showGameOverModal(`${winner.charAt(0).toUpperCase() + winner.slice(1)} Wins!`, `All opposing stones have been removed!`);
        return;
    }

    if (gameState !== 'GAME_OVER' && isAITurn()) {
        setTimeout(makeAIMove, 600);
    }
}

function countStonesByColor() {
    const counts = { white: 0, black: 0, red: 0, blue: 0 };
    board.forEach(node => { if (node.piece) counts[node.piece]++; });
    return counts;
}

function isAITurn() {
    if (!isVsComputer || gameState === 'GAME_OVER') return false;
    return numPlayers === 4 ? currentPlayer !== 'white' : currentPlayer === 'black';
}

// ============================================
// AI LOGIC
// ============================================

function makeAIMove() {
    try {
        if (gameState === 'GAME_OVER' || !isAITurn()) return;
        const me = currentPlayer;
        const myTarget = (PLAYER_CONFIG[me] && PLAYER_CONFIG[me].target) || { row: 0, col: 2 };
        const myDir = (PLAYER_CONFIG[me] && PLAYER_CONFIG[me].dir) || 'up';
        const forwardProgress = (fr, fc, tr, tc) => {
            if (myDir === 'up') return fr - tr;
            if (myDir === 'down') return tr - fr;
            if (myDir === 'right') return tc - fc;
            return fc - tc; // left
        };
        
        // Safety check: ensure 3D state is synced
        if (window.is3DView && window.update3DViews) window.update3DViews();

        let possibleMoves = [];

    // Gather all possible starting moves for black
    if (isInLeapChain) {
        // AI MUST continue the chain from current selectedStone
        const leapMoves = calculateLeapMoves(selectedStone.row, selectedStone.col, true, moveHistory[moveHistory.length - 1]?.direction);
        leapMoves.forEach(move => {
            possibleMoves.push({ stone: { row: selectedStone.row, col: selectedStone.col }, move: move });
        });
        
        // Voluntarily stop leap chain early based on difficulty
        let stopChance = 0;
        if (computerDifficulty === 'easy') stopChance = 0.5;
        else if (computerDifficulty === 'medium') stopChance = 0.2;
        
        if (possibleMoves.length > 0 && Math.random() < stopChance) {
            console.log("AI deciding to stay here.");
            selectedStone = null;
            validMoves = [];
            isInLeapChain = false;
            leapChainStart = null;
            endTurn();
            return;
        }
    } else {
        board.forEach((node, key) => {
            if (node.piece === me) {
                const walkMoves = calculateWalkMoves(node.row, node.col);
                const leapMoves = calculateLeapMoves(node.row, node.col);
                const moves = [...walkMoves, ...leapMoves];
                moves.forEach(move => {
                    possibleMoves.push({ stone: { row: node.row, col: node.col }, move: move });
                });
            }
        });
    }

    if (possibleMoves.length === 0) {
        // No moves for Black, silently end.
        endTurn();
        return;
    }

    let bestMove = null;
    let bestScore = -Infinity;

    possibleMoves.forEach(action => {
        let score = 0;
        const { stone, move } = action;

        // 1. Win condition: landing on my own target Artemis tip
        const targetNode = move.offBoard ? null : board.get(`${move.row},${move.col}`);
        if (targetNode && move.row === myTarget.row && move.col === myTarget.col) {
            score += 10000;
        }

        // 2. Capture opponent
        if (move.capture) {
            score += 500;
        }

        // 3. Advancement toward my target tip
        score += forwardProgress(stone.row, stone.col, move.row, move.col) * 10;
        // Absolute progress ranking (closer to target tip is better)
        score -= (Math.abs(move.row - myTarget.row) + Math.abs(move.col - myTarget.col)) * 3;

        // 4. Loop Prevention: Penalize moving the same stone too many times in a row
        if (!isInLeapChain && aiLastMovedStone &&
            aiLastMovedStone.row === stone.row &&
            aiLastMovedStone.col === stone.col) {
            if (aiConsecutiveMoveCount >= 2) score -= 300;
            else if (aiConsecutiveMoveCount >= 1) score -= 50;
        }

        // 5. Leap of faith is bad unless it's a capture (already scored)
        if (move.offBoard) {
            if (computerDifficulty === 'easy') {
                score -= 50; // Very little penalty, might do it randomly
            } else if (computerDifficulty === 'hard') {
                score -= 1000; // Hard avoids it strictly unless winning
            } else {
                score -= 200; // Normal penalty (Net score: 500 - 200 = 300)
            }
        }

        // 6. Hard mode: 1-ply Danger evaluation
        if (computerDifficulty === 'hard' && !move.offBoard) {
            // Check if moving to this spot puts the stone in immediate danger of being captured
            let inDanger = false;
            
            // Temporarily mock the move on the board
            const originalTargetPiece = targetNode ? targetNode.piece : null;
            if (targetNode) targetNode.piece = me;
            const originalStonePiece = board.get(`${stone.row},${stone.col}`).piece;
            board.get(`${stone.row},${stone.col}`).piece = null;

            board.forEach((node, key) => {
                if (node.piece && node.piece !== me && !inDanger) {
                    const enemyLeaps = calculateLeapMoves(node.row, node.col);
                    if (enemyLeaps.some(wMove => !wMove.offBoard && wMove.over.row === move.row && wMove.over.col === move.col)) {
                        inDanger = true;
                    }
                }
            });
            
            // Revert mock
            if (targetNode) targetNode.piece = originalTargetPiece;
            board.get(`${stone.row},${stone.col}`).piece = originalStonePiece;
            
            if (inDanger) {
                // Heavily penalize moving into danger
                score -= 800;
            }
        }

        // 7. Randomness based on difficulty
        if (computerDifficulty === 'easy') {
            score += Math.random() * 200;
        } else if (computerDifficulty === 'medium') {
            score += Math.random() * 50;
        } else {
            // Hard
            score += Math.random() * 5;
        }

        if (score > bestScore) {
            bestScore = score;
            bestMove = action;
        }
    });

    // Random fallback if no best move found but possibleMoves exists
    if (!bestMove && possibleMoves.length > 0) {
        console.warn("AI choosing randomly (fallback).");
        bestMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    }

    if (bestMove) {
        // Execute the move visually
        selectedStone = bestMove.stone; // mock select
        updateUI(); // Ensure Cancel btn doesn't flicker on computer turn

        // Execute the move
        selectedStone = bestMove.stone; // mock select
        updateUI(); 
        executeMove(bestMove.move);
    } else {
        console.warn("AI has no moves - passing turn.");
        endTurn();
    }
  } catch (err) {
    console.error("AI turn error:", err);
    isAnimating = false;
    endTurn();
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

// Switch player count (2 or 4) and restart with the matching board.
function setNumPlayers(n) {
    if (n !== 2 && n !== 4) return;
    numPlayers = n;
    initializeBoard();
    if (isAITurn()) setTimeout(makeAIMove, 500);
}
window.setNumPlayers = setNumPlayers;

resetButton.addEventListener('click', initializeBoard);
const cancelBtn = document.getElementById('cancel-button');
if (cancelBtn) cancelBtn.addEventListener('click', cancelMove);

// Opponent Menu Toggle Logic
const opponentBtnText = document.getElementById('opponent-btn');
const opponentMenu = document.getElementById('opponent-menu');

// Set initial button text based on stored preferences
if (opponentBtnText) {
    if (isVsComputer) {
        const levelLabel = computerDifficulty.charAt(0).toUpperCase() + computerDifficulty.slice(1);
        opponentBtnText.textContent = `Computer: ${levelLabel}`;
    } else {
        opponentBtnText.textContent = 'Opponent: Human';
    }
}

if (opponentBtnText && opponentMenu) {
    opponentBtnText.addEventListener('click', () => {
        opponentMenu.classList.toggle('show-menu');
    });

    const oppButtons = document.querySelectorAll('#opponent-menu button');
    oppButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            opponentMenu.classList.remove('show-menu');
            const opp = e.target.getAttribute('data-opp');
            
            // Full reset approach
            const wasVsComputer = isVsComputer;
            const previousDifficulty = computerDifficulty;
            
            if (opp === 'human') {
                isVsComputer = false;
                localStorage.setItem('templeVsComputer', 'false');
                opponentBtnText.textContent = 'Opponent: Human';
            } else {
                isVsComputer = true;
                computerDifficulty = opp;
                localStorage.setItem('templeVsComputer', 'true');
                localStorage.setItem('templeDifficulty', opp);
                const levelLabel = opp.charAt(0).toUpperCase() + opp.slice(1);
                opponentBtnText.textContent = `Computer: ${levelLabel}`;
            }

            // Always restart to wipe the slate clean
            console.log("Opponent changed - restarting game for clean state.");
            initializeBoard();
        });
    });
}

let _playersBtnTimeout = null;
// Players Menu Toggle Logic
const playersBtnText = document.getElementById('players-btn');
const playersMenu = document.getElementById('players-menu');
if (playersBtnText && playersMenu) {
    playersBtnText.addEventListener('click', () => {
        playersMenu.classList.toggle('show-menu');
    });
    playersMenu.querySelectorAll('button[data-players]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const n = parseInt(e.target.getAttribute('data-players'), 10);
            playersMenu.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            if (playersBtnText) playersBtnText.textContent = `${n} Players`;
            playersMenu.classList.remove('show-menu');
            setNumPlayers(n);
        });
    });
}

// Menu Toggle Logic
function toggleMenu() {
    const trigger = document.getElementById('menu-trigger');
    const header = document.getElementById('main-header');
    const hud = document.getElementById('hud');
    if (trigger) trigger.classList.toggle('active');
    if (header) header.classList.toggle('visible');
    if (hud) hud.classList.toggle('visible');
}
const menuTriggerBtn = document.getElementById('menu-trigger');
if (menuTriggerBtn) menuTriggerBtn.addEventListener('click', toggleMenu);

const closeHudBtn = document.getElementById('close-hud-btn');
if (closeHudBtn) closeHudBtn.addEventListener('click', toggleMenu);

document.addEventListener('keydown', (e) => {
    if (e.target !== document.body) return;

    // Space → open/close menu
    if (e.code === 'Space') {
        e.preventDefault();
        toggleMenu();
    }

    // Shift → toggle 2D / 3D view
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (window.is3DView) {
            const btn2d = document.getElementById('btn-view-2d');
            if (btn2d) btn2d.click();
        } else {
            const btn3d = document.getElementById('btn-view-3d');
            if (btn3d) btn3d.click();
        }
    }
});


// ============================================
// INITIALIZATION
// ============================================

// Modal interactions
const modalNewGameBtn = document.getElementById('modal-new-game');
const modalMenuBtn = document.getElementById('modal-menu');

if (modalNewGameBtn) {
    modalNewGameBtn.addEventListener('click', () => {
        hideGameOverModal();
        initializeBoard();
    });
}
if (modalMenuBtn) {
    modalMenuBtn.addEventListener('click', () => {
        hideGameOverModal();
        // Just let them look at board - no changes possible while in GAME_OVER state
    });
}

// Click outside Game Over modal to hide it (menu mode)
if (gameOverModal) {
    gameOverModal.addEventListener('click', (e) => {
        if (e.target === gameOverModal) {
            hideGameOverModal();
        }
    });
}

// Global listener to close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    // List of dropdown containers
    const dropdownContainers = ['.view-dropdown', '.opp-dropdown', '.players-dropdown'];
    
    dropdownContainers.forEach(selector => {
        const container = document.querySelector(selector);
        if (container && !container.contains(e.target)) {
            const menu = container.querySelector('.view-menu, .opp-menu, .players-menu');
            if (menu) menu.classList.remove('show-menu');
        }
    });
});

document.addEventListener('DOMContentLoaded', initializeBoard);

