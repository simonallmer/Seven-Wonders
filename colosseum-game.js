// COLOSSEUM GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS & BOARD STRUCTURE
// ============================================

const BOARD_CONFIG = {
    centerX: 400,
    centerY: 400,
    rings: [
        { count: 6, innerRadius: 80, outerRadius: 150 },   // Inner ring
        { count: 12, innerRadius: 150, outerRadius: 250 }, // Middle ring
        { count: 24, innerRadius: 250, outerRadius: 350 }  // Outer ring
    ],
    centerRadius: 80
};

// ============================================
// GAME STATE
// ============================================
let gameState = {
    fields: [],
    selectedField: null,
    selectedStoneColor: null, // 'white', 'black', or null
    stones: {}, // Maps field key (ring-index) to stone color
    scores: { white: 0, black: 0 }
};

// ... (skipping unchanged code)

// Make function available globally for HTML buttons
window.adjustCount = function (color, amount) {
    gameState.scores[color] += amount;
    updateScoreDisplay();
};

function updateScoreDisplay() {
    document.getElementById('white-count').textContent = gameState.scores.white;
    document.getElementById('black-count').textContent = gameState.scores.black;
}

// ============================================
// DOM ELEMENTS
// ============================================
const boardSVG = document.getElementById('game-board');
const statusElement = document.getElementById('game-status');
const whiteBox = document.querySelector('.white-box .box-content');
const blackBox = document.querySelector('.black-box .box-content');

// ============================================
// BOARD GENERATION
// ============================================

function initializeBoard() {
    gameState.fields = [];
    boardSVG.innerHTML = '';

    // Generate fields for each ring
    BOARD_CONFIG.rings.forEach((ring, ringIndex) => {
        const angleStep = 360 / ring.count;

        for (let i = 0; i < ring.count; i++) {
            const field = createField(ringIndex, i, angleStep, ring);
            gameState.fields.push(field);
        }
    });

    // Add center circle
    const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centerCircle.setAttribute('cx', BOARD_CONFIG.centerX);
    centerCircle.setAttribute('cy', BOARD_CONFIG.centerY);
    centerCircle.setAttribute('r', BOARD_CONFIG.centerRadius);
    centerCircle.setAttribute('class', 'center-circle');
    centerCircle.setAttribute('data-ring', -1);
    centerCircle.setAttribute('data-index', 0);

    centerCircle.addEventListener('click', () => handleFieldClick(-1, 0));

    boardSVG.appendChild(centerCircle);

    gameState.fields.push({
        ring: -1,
        index: 0,
        element: centerCircle
    });

    updateStatus('Board initialized - Click a field to select');
}

function createField(ringIndex, fieldIndex, angleStep, ring) {
    const startAngle = fieldIndex * angleStep - 90; // -90 to start from top
    const endAngle = startAngle + angleStep;

    const path = createRoundedWedgePath(
        BOARD_CONFIG.centerX,
        BOARD_CONFIG.centerY,
        ring.innerRadius,
        ring.outerRadius,
        startAngle,
        endAngle
    );

    const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathElement.setAttribute('d', path);
    pathElement.setAttribute('class', 'field');
    pathElement.setAttribute('data-ring', ringIndex);
    pathElement.setAttribute('data-index', fieldIndex);

    pathElement.addEventListener('click', () => handleFieldClick(ringIndex, fieldIndex));

    boardSVG.appendChild(pathElement);

    return {
        ring: ringIndex,
        index: fieldIndex,
        element: pathElement
    };
}

function createRoundedWedgePath(cx, cy, innerRadius, outerRadius, startAngle, endAngle) {
    const toRadians = (angle) => (angle * Math.PI) / 180;

    // Calculate points
    const innerStart = {
        x: cx + innerRadius * Math.cos(toRadians(startAngle)),
        y: cy + innerRadius * Math.sin(toRadians(startAngle))
    };

    const innerEnd = {
        x: cx + innerRadius * Math.cos(toRadians(endAngle)),
        y: cy + innerRadius * Math.sin(toRadians(endAngle))
    };

    const outerStart = {
        x: cx + outerRadius * Math.cos(toRadians(startAngle)),
        y: cy + outerRadius * Math.sin(toRadians(startAngle))
    };

    const outerEnd = {
        x: cx + outerRadius * Math.cos(toRadians(endAngle)),
        y: cy + outerRadius * Math.sin(toRadians(endAngle))
    };

    // Create path with rounded corners
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return `
        M ${innerStart.x} ${innerStart.y}
        L ${outerStart.x} ${outerStart.y}
        A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}
        L ${innerEnd.x} ${innerEnd.y}
        A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}
        Z
    `.trim();
}

// ============================================
// GAME LOGIC
// ============================================

function handleFieldClick(ring, index) {
    const fieldKey = `${ring}-${index}`;

    // If we have a stone color selected from a box
    if (gameState.selectedStoneColor) {
        // Place or replace stone on this field
        placeStone(ring, index, gameState.selectedStoneColor);
        clearStoneSelection();
        updateStatus('Stone placed. Click a box to select another stone.');
    }
    // If clicking a field with a stone
    else if (gameState.stones[fieldKey]) {
        // Pick up the stone
        const color = gameState.stones[fieldKey];
        removeStone(ring, index);
        gameState.selectedStoneColor = color;
        highlightBox(color);
        updateStatus(`Picked up ${color} stone. Click a field to place it, or click the ${color} box to return it.`);
    }
    else {
        updateStatus('Click a stone box first to select a color.');
    }
}

function handleBoxClick(color) {
    // If we already have a stone selected
    if (gameState.selectedStoneColor) {
        // Return it to the box (just clear selection)
        clearStoneSelection();
        updateStatus('Stone returned. Click a box to select a stone.');
    }
    // Pick up a new stone from the box
    else {
        gameState.selectedStoneColor = color;
        highlightBox(color);
        updateStatus(`Selected ${color} stone. Click a field to place it.`);
    }
}

function placeStone(ring, index, color) {
    const fieldKey = `${ring}-${index}`;
    const field = gameState.fields.find(f => f.ring === ring && f.index === index);

    if (!field) return;

    // Remove existing stone if any
    removeStone(ring, index);

    // Add new stone
    gameState.stones[fieldKey] = color;

    // Calculate stone position (center of field)
    let x, y;

    if (ring === -1) {
        // Center field
        x = BOARD_CONFIG.centerX;
        y = BOARD_CONFIG.centerY;
    } else {
        // Ring fields
        const ringConfig = BOARD_CONFIG.rings[ring];
        const angleStep = 360 / ringConfig.count;
        const angle = (index * angleStep - 90 + angleStep / 2) * Math.PI / 180;
        const radius = (ringConfig.innerRadius + ringConfig.outerRadius) / 2;

        x = BOARD_CONFIG.centerX + radius * Math.cos(angle);
        y = BOARD_CONFIG.centerY + radius * Math.sin(angle);
    }

    // Create stone circle
    const stone = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    stone.setAttribute('cx', x);
    stone.setAttribute('cy', y);
    stone.setAttribute('r', 15);
    stone.setAttribute('class', `stone stone-${color}`);
    stone.setAttribute('data-field', fieldKey);

    boardSVG.appendChild(stone);
}

function removeStone(ring, index) {
    const fieldKey = `${ring}-${index}`;

    if (!gameState.stones[fieldKey]) return;

    delete gameState.stones[fieldKey];

    // Remove stone element from SVG
    const stoneElement = boardSVG.querySelector(`[data-field="${fieldKey}"]`);
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

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeBoard();
    updateScoreDisplay();
    updateStatus('Click a stone box to select a stone, then click a field to place it.');
});
