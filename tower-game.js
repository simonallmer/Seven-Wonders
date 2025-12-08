// TOWER GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS & TOWER STRUCTURE
// ============================================

const TOWER_CONFIG = {
    centerX: 300,
    levels: [
        { y: 1050, radius: 180 },  // Level 1 (bottom)
        { y: 875, radius: 160 },   // Level 2
        { y: 700, radius: 140 },   // Level 3
        { y: 525, radius: 120 },   // Level 4
        { y: 350, radius: 100 }    // Level 5 (top)
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

    // Create the Tip (Central field above top level)
    createTip();

    updateStatus('Click a stone box to select a stone, then click an edge to place it.');
}

function createTip() {
    const topLevel = TOWER_CONFIG.levels[TOWER_CONFIG.levels.length - 1];
    const spacing = 175; // Distance between levels

    // Position platform above top level
    const cx = TOWER_CONFIG.centerX;
    const cy = topLevel.y - spacing; // Y=50

    // Draw Visual Mini Platform (Octagon)
    const platformRadius = 40; // Smaller than top level (100)
    const points = getOctagonPoints(cx, cy, platformRadius);
    const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')} Z`;

    const platform = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    platform.setAttribute('d', pathData);
    platform.setAttribute('class', 'octagon-level'); // Re-use styling
    platform.setAttribute('style', 'opacity: 0.8;'); // Slightly different to distinguish
    boardSVG.appendChild(platform);

    // Create interactive tip marker at the center
    const tip = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    tip.setAttribute('cx', cx);
    tip.setAttribute('cy', cy);
    tip.setAttribute('r', TOWER_CONFIG.edgeRadius * 1.5);
    tip.setAttribute('class', 'edge-position tip-field');
    tip.setAttribute('data-level', 5); // Level 5 is Tip
    tip.setAttribute('data-edge', 0);

    tip.addEventListener('click', () => handleEdgeClick(5, 0));

    boardSVG.appendChild(tip);

    gameState.edges.push({
        level: 5,
        edge: 0,
        x: cx,
        y: cy,
        element: tip
    });
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

    // 1. Create Edge Positions (Indices 0-7)
    for (let edgeIndex = 0; edgeIndex < TOWER_CONFIG.edgesPerLevel; edgeIndex++) {
        const p1 = points[edgeIndex];
        const p2 = points[(edgeIndex + 1) % TOWER_CONFIG.edgesPerLevel];

        // Calculate midpoint of edge
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        createFieldMarker(levelIndex, edgeIndex, midX, midY);
    }

    // 2. Create Center Position (Index 8) (treating as 'middle field')
    // Using index 8 to avoid negative numbers if possible, but TOWER_CONFIG.edgesPerLevel is 8.
    // So 8 is a valid distinct index.
    const centerIndex = 8;
    createFieldMarker(levelIndex, centerIndex, TOWER_CONFIG.centerX, level.y, 'center-field');
}

function createFieldMarker(level, edge, x, y, extraClass = '') {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    marker.setAttribute('cx', x);
    marker.setAttribute('cy', y);
    marker.setAttribute('r', TOWER_CONFIG.edgeRadius);
    marker.setAttribute('class', `edge-position ${extraClass}`);
    marker.setAttribute('data-level', level);
    marker.setAttribute('data-edge', edge);

    marker.addEventListener('click', () => handleEdgeClick(level, edge));

    boardSVG.appendChild(marker);

    gameState.edges.push({
        level: level,
        edge: edge,
        x: x,
        y: y,
        element: marker
    });
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

    // 2. Generate Levels
    TOWER_CONFIG.levels.forEach((level, levelIndex) => {
        createOctagon(levelIndex, level);
        createEdgePositions(levelIndex, level);
    });

    // Create the Tip (Central field above top level)
    createTip();

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

    // "Tilt" effect: Scale Y axis to flatten the octagon
    const tiltScale = 0.6;

    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI / 4) - Math.PI / 2 + angleOffset + rotationRadians;
        points.push({
            x: cx + radius * Math.cos(angle),
            y: cy + (radius * Math.sin(angle) * tiltScale) // Apply tilt
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
    const CENTER_INDEX = 8; // Constant for center field
    const myColor = gameState.selectedStoneColor;

    // Movement involving the Tip (Level 5)
    if (currentLevel === 5) {
        // From Tip, can go to any edge on Level 4 (Top Level) OR Center of Level 4?
        // Let's stick to edges as per previous request + Center?
        return targetLevel === 4 && targetEdge !== CENTER_INDEX;
    }
    if (targetLevel === 5) {
        // To Tip, can come from any edge on Level 4
        return currentLevel === 4 && currentEdge !== CENTER_INDEX;
    }

    // Movement involving Center Fields (Index 8)
    if (currentEdge === CENTER_INDEX && targetEdge === CENTER_INDEX) {
        // Vertical movement between centers
        // Check path for opposing stones
        const dir = Math.sign(targetLevel - currentLevel);
        const opponent = myColor === 'white' ? 'black' : 'white';

        // Loop through levels BETWEEN current and target
        for (let l = currentLevel + dir; l !== targetLevel; l += dir) {
            const stone = gameState.stones[`${l}-${CENTER_INDEX}`];
            if (stone === opponent) return false; // Blocked by opponent
        }
        return true;
    }

    if (currentEdge === CENTER_INDEX) {
        // From Center: Can go to any edge on SAME level
        if (targetLevel === currentLevel && targetEdge !== CENTER_INDEX) return true;
        return false;
    }
    if (targetEdge === CENTER_INDEX) {
        // To Center: Can come from any edge on SAME level
        if (targetLevel === currentLevel) return true;
        return false;
    }

    // Standard Edge Movement
    // Same level, adjacent edge (wrapping around)
    if (targetLevel === currentLevel) {
        const edgeDiff = Math.abs(targetEdge - currentEdge);
        return edgeDiff === 1 || edgeDiff === TOWER_CONFIG.edgesPerLevel - 1;
    }

    // Different level, same edge
    if (targetEdge === currentEdge) {
        // Can move up one level OR fall down to any lower level
        if (targetLevel === currentLevel + 1) return true; // Move up one level
        // Fall to any lower level - Explicitely allowing "falling past enemy stones" 
        // implies we don't check path occupancy for falling.
        if (targetLevel < currentLevel) return true;
    }

    return false;
}

function showValidMoves(level, edge) {
    clearValidMoves();
    const CENTER_INDEX = 8;
    const myColor = gameState.selectedStoneColor;
    const opponent = myColor === 'white' ? 'black' : 'white';

    // From Tip
    if (level === 5) {
        // Highlight all edges on Level 4
        for (let i = 0; i < TOWER_CONFIG.edgesPerLevel; i++) {
            markValidMove(4, i);
        }
        return;
    }

    // From Center Field
    if (edge === CENTER_INDEX) {
        // 1. To Edges on SAME level
        for (let i = 0; i < TOWER_CONFIG.edgesPerLevel; i++) {
            markValidMove(level, i);
        }

        // 2. To Center on ANY other level (Up or Down), checking path
        // Go UP
        for (let l = level + 1; l < TOWER_CONFIG.levels.length; l++) {
            // Check if blocked by opponent immediately above logic?
            // No, "as long as no stone... is in between".
            // We check the 'in between' spots. 
            // If we want to go from L1 to L3, L2 is in between.

            let blocked = false;
            // Check intermediate levels
            for (let k = level + 1; k < l; k++) {
                if (gameState.stones[`${k}-${CENTER_INDEX}`] === opponent) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) break; // If path to L is blocked, path to L+1 is definitely blocked? 
            // Actually if L2 is blocked, I can't go to L3? Yes, "in between". 
            // So if I hit a block, I stop scanning this direction.

            // Check if target itself is occupied? markValidMove handles that.
            // But if target is occupied by OPPONENT, does it block further?
            // "no stone of opposing color is in between".
            // This implies if L2 is opponent, it blocks L3.

            // If L2 is friendly. Does it block L3? Rule says "opposing color". So friendly doesn't block?
            // Assume friendly allows pass-through.

            markValidMove(l, CENTER_INDEX);

            // Update blockage for NEXT steps
            if (gameState.stones[`${l}-${CENTER_INDEX}`] === opponent) {
                break; // Stones beyond this are blocked
            }
        }

        // Go DOWN
        for (let l = level - 1; l >= 0; l--) {
            let blocked = false;
            for (let k = level - 1; k > l; k--) {
                if (gameState.stones[`${k}-${CENTER_INDEX}`] === opponent) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) break;

            markValidMove(l, CENTER_INDEX);

            if (gameState.stones[`${l}-${CENTER_INDEX}`] === opponent) {
                break;
            }
        }

        return;
    }

    // From Regular Edge

    // 1. To Center on same level
    markValidMove(level, CENTER_INDEX);

    // 2. Adjacent edges on same level
    const leftEdge = (edge - 1 + TOWER_CONFIG.edgesPerLevel) % TOWER_CONFIG.edgesPerLevel;
    const rightEdge = (edge + 1) % TOWER_CONFIG.edgesPerLevel;

    markValidMove(level, leftEdge);
    markValidMove(level, rightEdge);

    // 3. Same edge on level above (move up one)
    if (level < TOWER_CONFIG.levels.length - 1) {
        markValidMove(level + 1, edge);
    }
    // If at Top Level (4), can move to Tip (5)
    else if (level === 4) {
        markValidMove(5, 0);
    }

    // 4. Same edge on ALL levels below (fall down)
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
