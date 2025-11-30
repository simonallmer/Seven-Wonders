// TOWER GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS & TOWER STRUCTURE
// ============================================

const TOWER_CONFIG = {
    centerX: 300,
    levels: [
        { y: 800, radius: 180 },  // Level 1 (bottom)
        { y: 650, radius: 160 },  // Level 2
        { y: 500, radius: 140 },  // Level 3
        { y: 350, radius: 120 },  // Level 4
        { y: 200, radius: 100 }   // Level 5 (top)
    ],
    edgesPerLevel: 8,
    edgeRadius: 12
};

// ============================================
// GAME STATE
// ============================================
let gameState = {
    edges: [],
    selectedEdge: null,
    selectedStoneColor: null,
    stones: {}, // Maps edge key (level-edge) to stone color
    validMoves: [],
    rotation: 0 // Current rotation in degrees (0, 90, 180, 270)
};

// ============================================
// DOM ELEMENTS
// ============================================
const boardSVG = document.getElementById('game-board');
const statusElement = document.getElementById('game-status');
const whiteBox = document.querySelector('.white-box .box-content');
const blackBox = document.querySelector('.black-box .box-content');
const rotateLeftBtn = document.getElementById('rotate-left');
const rotateRightBtn = document.getElementById('rotate-right');

// ============================================
// BOARD GENERATION
// ============================================

function initializeBoard() {
    gameState.edges = [];
    gameState.stones = {};
    boardSVG.innerHTML = '';

    // Generate each level
    TOWER_CONFIG.levels.forEach((level, levelIndex) => {
        createOctagon(levelIndex, level);
        createEdgePositions(levelIndex, level);
    });

    updateStatus('Click a stone box to select a stone, then click an edge to place it.');
}

function createOctagon(levelIndex, level) {
    const points = getOctagonPoints(TOWER_CONFIG.centerX, level.y, level.radius);
    const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')} Z`;

    const octagon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    octagon.setAttribute('d', pathData);
    octagon.setAttribute('class', 'octagon-level');
    octagon.setAttribute('data-level', levelIndex);

    boardSVG.appendChild(octagon);
}

function createEdgePositions(levelIndex, level) {
    const points = getOctagonPoints(TOWER_CONFIG.centerX, level.y, level.radius);

    for (let edgeIndex = 0; edgeIndex < TOWER_CONFIG.edgesPerLevel; edgeIndex++) {
        const p1 = points[edgeIndex];
        const p2 = points[(edgeIndex + 1) % TOWER_CONFIG.edgesPerLevel];

        // Calculate midpoint of edge
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        // Create edge position marker
        const edge = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        edge.setAttribute('cx', midX);
        edge.setAttribute('cy', midY);
        edge.setAttribute('r', TOWER_CONFIG.edgeRadius);
        edge.setAttribute('class', 'edge-position');
        edge.setAttribute('data-level', levelIndex);
        edge.setAttribute('data-edge', edgeIndex);

        edge.addEventListener('click', () => handleEdgeClick(levelIndex, edgeIndex));

        boardSVG.appendChild(edge);

        gameState.edges.push({
            level: levelIndex,
            edge: edgeIndex,
            x: midX,
            y: midY,
            element: edge
        });
    }
}

function getOctagonPoints(cx, cy, radius) {
    const points = [];
    const angleOffset = Math.PI / 8; // Start from top

    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI / 4) - Math.PI / 2 + angleOffset;
        points.push({
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle)
        });
    }

    return points;
}

// ============================================
// ROTATION
// ============================================

function rotateView(direction) {
    // Update rotation state
    if (direction === 'left') {
        gameState.rotation = (gameState.rotation - 90 + 360) % 360;
    } else {
        gameState.rotation = (gameState.rotation + 90) % 360;
    }

    // Redraw board with new rotation
    redrawBoard();
}

function redrawBoard() {
    // Save stone positions
    const savedStones = { ...gameState.stones };

    // Clear and regenerate board
    boardSVG.innerHTML = '';
    gameState.edges = [];

    TOWER_CONFIG.levels.forEach((level, levelIndex) => {
        createOctagon(levelIndex, level);
        createEdgePositions(levelIndex, level);
    });

    // Restore stones
    Object.entries(savedStones).forEach(([edgeKey, color]) => {
        const [level, edge] = edgeKey.split('-').map(Number);
        placeStone(level, edge, color);
    });

    // Restore selection if any
    if (gameState.selectedStoneColor) {
        highlightBox(gameState.selectedStoneColor);
    }
}

function getOctagonPoints(cx, cy, radius) {
    const points = [];
    const angleOffset = Math.PI / 8; // Start from top
    const rotationRadians = (gameState.rotation * Math.PI) / 180;

    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI / 4) - Math.PI / 2 + angleOffset + rotationRadians;
        points.push({
            x: cx + radius * Math.cos(angle),
            y: cy + radius * Math.sin(angle)
        });
    }

    return points;
}

// ============================================
// GAME LOGIC
// ============================================

function handleEdgeClick(level, edge) {
    const edgeKey = `${level}-${edge}`;

    // If we have a stone color selected from a box
    if (gameState.selectedStoneColor) {
        placeStone(level, edge, gameState.selectedStoneColor);
        clearStoneSelection();
        clearValidMoves();
        updateStatus('Stone placed. Click a box to select another stone.');
    }
    // If clicking an edge with a stone
    else if (gameState.stones[edgeKey]) {
        // Pick up the stone
        const color = gameState.stones[edgeKey];
        removeStone(level, edge);
        gameState.selectedStoneColor = color;
        gameState.selectedEdge = { level, edge };
        highlightBox(color);
        showValidMoves(level, edge);
        updateStatus(`Picked up ${color} stone. Click an edge to move it, or click the ${color} box to return it.`);
    }
    // If clicking an empty edge while holding a stone
    else if (gameState.selectedEdge) {
        // Check if it's a valid move
        if (isValidMove(level, edge)) {
            placeStone(level, edge, gameState.selectedStoneColor);
            gameState.selectedEdge = null;
            clearStoneSelection();
            clearValidMoves();
            updateStatus('Stone moved. Click a box to select another stone.');
        } else {
            updateStatus('Invalid move! You can only move to adjacent edges or same edge on different level.');
        }
    }
    else {
        updateStatus('Click a stone box first to select a color.');
    }
}

function handleBoxClick(color) {
    if (gameState.selectedStoneColor) {
        clearStoneSelection();
        clearValidMoves();
        gameState.selectedEdge = null;
        updateStatus('Stone returned. Click a box to select a stone.');
    } else {
        gameState.selectedStoneColor = color;
        highlightBox(color);
        updateStatus(`Selected ${color} stone. Click an edge to place it.`);
    }
}

function isValidMove(targetLevel, targetEdge) {
    if (!gameState.selectedEdge) return false;

    const { level: currentLevel, edge: currentEdge } = gameState.selectedEdge;

    // Same level, adjacent edge (wrapping around)
    if (targetLevel === currentLevel) {
        const edgeDiff = Math.abs(targetEdge - currentEdge);
        return edgeDiff === 1 || edgeDiff === TOWER_CONFIG.edgesPerLevel - 1;
    }

    // Different level, same edge
    if (targetEdge === currentEdge) {
        // Can move up one level OR fall down to any lower level
        if (targetLevel === currentLevel + 1) return true; // Move up one level
        if (targetLevel < currentLevel) return true; // Fall to any lower level
    }

    return false;
}

function showValidMoves(level, edge) {
    clearValidMoves();

    // Adjacent edges on same level
    const leftEdge = (edge - 1 + TOWER_CONFIG.edgesPerLevel) % TOWER_CONFIG.edgesPerLevel;
    const rightEdge = (edge + 1) % TOWER_CONFIG.edgesPerLevel;

    markValidMove(level, leftEdge);
    markValidMove(level, rightEdge);

    // Same edge on level above (move up one)
    if (level < TOWER_CONFIG.levels.length - 1) {
        markValidMove(level + 1, edge);
    }

    // Same edge on ALL levels below (fall down)
    for (let lowerLevel = level - 1; lowerLevel >= 0; lowerLevel--) {
        markValidMove(lowerLevel, edge);
    }
}

function markValidMove(level, edge) {
    const edgeKey = `${level}-${edge}`;
    if (gameState.stones[edgeKey]) return; // Don't mark occupied edges

    const edgeData = gameState.edges.find(e => e.level === level && e.edge === edge);
    if (edgeData) {
        edgeData.element.classList.add('valid-move');
        gameState.validMoves.push(edgeData.element);
    }
}

function clearValidMoves() {
    gameState.validMoves.forEach(element => {
        element.classList.remove('valid-move');
    });
    gameState.validMoves = [];
}

function placeStone(level, edge, color) {
    const edgeKey = `${level}-${edge}`;
    const edgeData = gameState.edges.find(e => e.level === level && e.edge === edge);

    if (!edgeData) return;

    // Remove existing stone if any
    removeStone(level, edge);

    // Add new stone
    gameState.stones[edgeKey] = color;

    // Create stone circle
    const stone = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    stone.setAttribute('cx', edgeData.x);
    stone.setAttribute('cy', edgeData.y);
    stone.setAttribute('r', 10);
    stone.setAttribute('class', `stone stone-${color}`);
    stone.setAttribute('data-edge', edgeKey);

    boardSVG.appendChild(stone);
}

function removeStone(level, edge) {
    const edgeKey = `${level}-${edge}`;

    if (!gameState.stones[edgeKey]) return;

    delete gameState.stones[edgeKey];

    const stoneElement = boardSVG.querySelector(`[data-edge="${edgeKey}"]`);
    if (stoneElement) {
        stoneElement.remove();
    }
}

function highlightBox(color) {
    whiteBox.classList.remove('selected');
    blackBox.classList.remove('selected');

    if (color === 'white') {
        whiteBox.classList.add('selected');
    } else if (color === 'black') {
        blackBox.classList.add('selected');
    }
}

function clearStoneSelection() {
    gameState.selectedStoneColor = null;
    whiteBox.classList.remove('selected');
    blackBox.classList.remove('selected');
}

function updateStatus(message) {
    statusElement.textContent = message;
}

// ============================================
// EVENT LISTENERS
// ============================================

whiteBox.addEventListener('click', () => handleBoxClick('white'));
blackBox.addEventListener('click', () => handleBoxClick('black'));
rotateLeftBtn.addEventListener('click', () => rotateView('left'));
rotateRightBtn.addEventListener('click', () => rotateView('right'));

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeBoard();
});
