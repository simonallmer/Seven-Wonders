// COLOSSEUM GAME - Seven Wonders Series
// Game Design: Simon Allmer

// ============================================
// CONSTANTS & BOARD STRUCTURE
// ============================================

const BOARD_CONFIG = {
    centerX: 400,
    centerY: 400,
    rings: [
        { count: 6, innerRadius: 80, outerRadius: 150 },
        { count: 12, innerRadius: 150, outerRadius: 250 },
        { count: 24, innerRadius: 250, outerRadius: 350 }
    ],
    centerRadius: 80,
    rotation: -30 // Shift field visual 30 degrees CCW to align the formation
};

const STARTING_FIELDS = {
    white: [
        { ring: 2, indices: [12, 13, 14, 15] },
        { ring: 1, indices: [6, 7] },
        { ring: 0, indices: [3] }
    ],
    black: [
        { ring: 2, indices: [0, 1, 2, 3] },
        { ring: 1, indices: [0, 1] },
        { ring: 0, indices: [0] }
    ]
};

// ============================================
// GAME STATE
// ============================================
let gameState = {
    fields: [],
    selectedStoneColor: null, // tracked when log-in strength is active
    currentStrength: 1,
    selectedDie: null,
    originField: null,
    validMoves: [],
    stones: {},
    currentTurn: 'white',
    awaitingDirectionTiger: null
};

// ============================================
// UI UPDATES
// ============================================

function updateTurnUI() {
    const whiteBoxEl = document.getElementById('white-box');
    const blackBoxEl = document.getElementById('black-box');

    document.body.classList.remove('turn-white', 'turn-black');
    document.body.classList.add(`turn-${gameState.currentTurn}`);

    if (gameState.currentTurn === 'white') {
        whiteBoxEl.classList.add('active-turn');
        blackBoxEl.classList.remove('active-turn');
    } else {
        blackBoxEl.classList.add('active-turn');
        whiteBoxEl.classList.remove('active-turn');
    }
}

function switchTurn() {
    moveTigers();
    gameState.currentTurn = gameState.currentTurn === 'white' ? 'black' : 'white';
    updateTurnUI();
    updateStatus(`${gameState.currentTurn.charAt(0).toUpperCase() + gameState.currentTurn.slice(1)}'s turn.`);
}

function updateStatus(message) {
    const statusEl = document.getElementById('game-status');
    if (statusEl) statusEl.textContent = message;
}

window.setStrength = function (val) {
    if (gameState.awaitingDirectionTiger) return;

    gameState.currentStrength = val;
    gameState.selectedStoneColor = gameState.currentTurn;
    highlightBox(gameState.currentTurn);

    document.querySelectorAll('.strength-btn').forEach(btn => {
        btn.classList.remove('active');
        if (val === 'tiger' && btn.classList.contains('tiger-btn')) {
            btn.classList.add('active');
        } else if (btn.dataset.strength == val) {
            btn.classList.add('active');
        }
    });

    showPlacementHighlights();
    updateStatus(`${gameState.currentTurn.charAt(0).toUpperCase() + gameState.currentTurn.slice(1)}: Place ${val === 'tiger' ? 'Tiger' : 'S:' + val} in your starting zone.`);
};

function highlightBox(color) {
    const whiteBox = document.getElementById('white-box');
    const blackBox = document.getElementById('black-box');
    whiteBox.classList.remove('selected');
    blackBox.classList.remove('selected');
    if (color === 'white') whiteBox.classList.add('selected');
    else if (color === 'black') blackBox.classList.add('selected');
}

function clearStoneSelection() {
    gameState.selectedStoneColor = null;
    gameState.selectedDie = null;
    gameState.originField = null;
    gameState.validMoves = [];

    const whiteBox = document.getElementById('white-box');
    const blackBox = document.getElementById('black-box');
    whiteBox.classList.remove('selected');
    blackBox.classList.remove('selected');

    document.querySelectorAll('.strength-btn').forEach(btn => btn.classList.remove('active'));

    clearHighlights();
}

function showPlacementHighlights() {
    clearHighlights();
    const zones = STARTING_FIELDS[gameState.currentTurn];
    zones.forEach(zone => {
        zone.indices.forEach(idx => {
            const field = gameState.fields.find(f => f.ring === zone.ring && f.index === idx);
            if (field) field.element.classList.add('highlight-move');
        });
    });
}

// ============================================
// TIGER AUTOMATION
// ============================================

function moveTigers() {
    let allTigers = [];
    Object.keys(gameState.stones).forEach(fieldKey => {
        let fieldDice = gameState.stones[fieldKey];
        if (!fieldDice) return;
        fieldDice.forEach(die => {
            if (die.isTiger && die.direction !== undefined) {
                const [r, i] = fieldKey.split('-').map(Number);
                allTigers.push({ ring: r, index: i, die, originalKey: fieldKey });
            }
        });
    });

    if (allTigers.length === 0) return;

    allTigers.forEach(t => {
        let fieldDice = gameState.stones[t.originalKey];
        const idx = fieldDice.indexOf(t.die);
        if (idx > -1) fieldDice.splice(idx, 1);
        renderFieldDice(t.ring, t.index);
    });

    let newPlacements = [];
    allTigers.forEach(t => {
        const count = BOARD_CONFIG.rings[t.ring].count;
        const newIndex = (t.index + t.die.direction + count) % count;
        newPlacements.push({ ring: t.ring, index: newIndex, die: t.die });
    });

    let targetMap = {};
    newPlacements.forEach(p => {
        const key = `${p.ring}-${p.index}`;
        if (!targetMap[key]) targetMap[key] = [];
        targetMap[key].push(p);
    });

    Object.keys(targetMap).forEach(key => {
        const pieces = targetMap[key];
        const sides = new Set(pieces.map(p => p.die.color));

        if (sides.size > 1) {
            updateStatus('Tiger Clash! Opposing Tigers removed.');
        } else {
            pieces.forEach(p => placeDieObject(p.ring, p.index, p.die));
        }
    });
}

// ============================================
// INTERACTION
// ============================================

function handleFieldClick(ring, index) {
    if (gameState.awaitingDirectionTiger) {
        updateStatus('Select a direction for the Tiger (Arrows)!');
        return;
    }

    const fieldKey = `${ring}-${index}`;

    // Priority 1: Check if we are selecting a piece to move while in placement mode
    if (gameState.selectedStoneColor && !gameState.selectedDie) {
        const diceAtField = gameState.stones[fieldKey];
        if (diceAtField && diceAtField.length > 0) {
            const topDie = diceAtField[diceAtField.length - 1];
            if (topDie.color === gameState.currentTurn) {
                clearStoneSelection();
            }
        }
    }

    // Priority 2: Handling active selection (Placement or Movement Destination)
    if (gameState.selectedStoneColor) {
        if (gameState.originField) {
            const isValid = gameState.validMoves.some(m => m.ring === ring && m.index === index);
            if (!isValid) return updateStatus('Too far away!');
        } else {
            // Restriction for new placements
            const zones = STARTING_FIELDS[gameState.selectedStoneColor];
            const isInsideZone = zones.some(z => z.ring === ring && z.indices.includes(index));
            if (!isInsideZone) {
                return updateStatus('Placement restricted to your starting zone!');
            }
        }

        if (gameState.selectedDie) {
            placeDieObject(ring, index, gameState.selectedDie);
            clearStoneSelection();
            switchTurn();
        } else {
            const isTiger = gameState.currentStrength === 'tiger';
            if (isTiger) {
                const newDie = { color: gameState.selectedStoneColor, strength: 6, movement: 1, isTiger: true };
                placeDieObject(ring, index, newDie);
                const dieIdx = gameState.stones[fieldKey].length - 1;
                gameState.awaitingDirectionTiger = { fieldKey, dieIdx };
                renderFieldDice(ring, index);
                updateStatus('Tiger placed. Select direction!');
            } else {
                placeDie(ring, index, gameState.selectedStoneColor, gameState.currentStrength);
                clearStoneSelection();
                switchTurn();
            }
        }
    } else {
        const dice = gameState.stones[fieldKey];
        if (dice && dice.length > 0) {
            const lastDie = dice[dice.length - 1];
            if (lastDie.color !== gameState.currentTurn) return updateStatus(`It's ${gameState.currentTurn}'s turn!`);
            dice.pop();
            gameState.selectedStoneColor = lastDie.color;
            gameState.selectedDie = lastDie;
            gameState.originField = { ring, index };
            gameState.validMoves = calculateValidMoves(ring, index, lastDie);
            renderFieldDice(ring, index);
            highlightBox(lastDie.color);
            showMoveHighlights();
            updateStatus(`Moving ${lastDie.isTiger ? 'Tiger' : 'S:' + lastDie.strength}.`);
        }
    }
}

function placeDie(ring, index, color, sVal) {
    const strength = parseInt(sVal);
    const movement = 5 - strength;
    placeDieObject(ring, index, { color, strength, movement, isTiger: false });
}

function placeDieObject(ring, index, die) {
    const key = `${ring}-${index}`;
    if (!gameState.stones[key]) gameState.stones[key] = [];
    gameState.stones[key].push(die);

    const opp = die.color === 'white' ? 'black' : 'white';
    const hasOpp = gameState.stones[key].some(d => d.color === opp);

    if (die.isTiger && hasOpp) {
        gameState.stones[key] = gameState.stones[key].filter(d => d.color === die.color && d !== die);
        updateStatus('Tiger Strike!');
    } else {
        const wS = gameState.stones[key].filter(d => d.color === 'white').reduce((s, d) => s + d.strength, 0);
        const bS = gameState.stones[key].filter(d => d.color === 'black').reduce((s, d) => s + d.strength, 0);
        if (wS > bS && bS > 0) {
            gameState.stones[key] = gameState.stones[key].filter(d => d.color === 'white');
            updateStatus('White Victory!');
        } else if (bS > wS && wS > 0) {
            gameState.stones[key] = gameState.stones[key].filter(d => d.color === 'black');
            updateStatus('Black Victory!');
        }
    }
    renderFieldDice(ring, index);
}

window.applyAutomaticFormation = function () {
    // Clear existing stones
    gameState.stones = {};

    // Clear all die elements from the board SVG
    const board = document.getElementById('game-board');
    if (board) {
        board.querySelectorAll('.die-container').forEach(el => el.remove());
        board.querySelectorAll('.tiger-arrow-group').forEach(el => el.remove());
    }

    // Reset game state related to selection
    clearStoneSelection();

    // Formation (7 dice): 
    // Outer (Ring 2): [2, 1, 1, 2]
    // Middle (Ring 1): [3, 3]
    // Inner (Ring 0): [4]

    // White (Bottom Cluster - Centered at 120 degrees)
    placeDie(2, 12, 'white', 2);
    placeDie(2, 13, 'white', 1);
    placeDie(2, 14, 'white', 1);
    placeDie(2, 15, 'white', 2);
    placeDie(1, 6, 'white', 3);
    placeDie(1, 7, 'white', 3);
    placeDie(0, 3, 'white', 4);

    // Black (Top Cluster - Centered at 300 degrees)
    placeDie(2, 0, 'black', 2);
    placeDie(2, 1, 'black', 1);
    placeDie(2, 2, 'black', 1);
    placeDie(2, 3, 'black', 2);
    placeDie(1, 0, 'black', 3);
    placeDie(1, 1, 'black', 3);
    placeDie(0, 0, 'black', 4);

    // Reset turn to white and update UI
    gameState.currentTurn = 'white';
    updateTurnUI();
    updateStatus("Automatic formation applied. White's turn.");
};

// ============================================
// MOVEMENT HELPERS
// ============================================

function calculateValidMoves(ring, index, piece) {
    if (piece.isTiger) {
        if (ring === -1) return [];
        const count = BOARD_CONFIG.rings[ring].count;
        return [{ ring, index: (index - 1 + count) % count }, { ring, index: (index + 1) % count }];
    }
    const max = piece.movement;
    let visited = new Set(), queue = [{ ring, index, dist: 0 }], valid = [];
    visited.add(`${ring}-${index}`);
    while (queue.length > 0) {
        let c = queue.shift();
        if (c.dist > 0 && c.dist <= max) valid.push({ ring: c.ring, index: c.index });
        if (c.dist < max) {
            getNeighbors(c.ring, c.index).forEach(n => {
                const k = `${n.ring}-${n.index}`;
                if (!visited.has(k)) {
                    visited.add(k);
                    queue.push({ ring: n.ring, index: n.index, dist: c.dist + 1 });
                }
            });
        }
    }
    return valid;
}

function getNeighbors(ring, index) {
    let n = [];
    if (ring !== -1) {
        const count = BOARD_CONFIG.rings[ring].count;
        n.push({ ring, index: (index - 1 + count) % count });
        n.push({ ring, index: (index + 1) % count });
    }
    if (ring === -1) { for (let i = 0; i < 6; i++) n.push({ ring: 0, index: i }); }
    else if (ring === 0) { n.push({ ring: -1, index: 0 }, { ring: 1, index: index * 2 }, { ring: 1, index: index * 2 + 1 }); }
    else if (ring === 1) { n.push({ ring: 0, index: Math.floor(index / 2) }, { ring: 2, index: index * 2 }, { ring: 2, index: index * 2 + 1 }); }
    else if (ring === 2) { n.push({ ring: 1, index: Math.floor(index / 2) }); }
    return n;
}

function showMoveHighlights() {
    clearHighlights();
    const board = document.getElementById('game-board');
    if (gameState.originField) {
        const origin = gameState.fields.find(f => f.ring === gameState.originField.ring && f.index === gameState.originField.index);
        if (origin) origin.element.classList.add('highlight-origin');
    }
    gameState.validMoves.forEach(m => {
        const f = gameState.fields.find(fi => fi.ring === m.ring && fi.index === m.index);
        if (f) f.element.classList.add('highlight-move');
    });
}

function clearHighlights() {
    gameState.fields.forEach(f => {
        f.element.classList.remove('highlight-move');
        f.element.classList.remove('highlight-origin');
    });
}

// ============================================
// RENDERING
// ============================================

function renderFieldDice(ring, index) {
    const fieldKey = `${ring}-${index}`;
    const board = document.getElementById('game-board');
    if (!board) return;

    const dice = gameState.stones[fieldKey] || [];

    board.querySelectorAll(`.tiger-arrows-${fieldKey}`).forEach(a => a.remove());
    board.querySelectorAll(`[data-field="${fieldKey}"]`).forEach(el => el.remove());

    if (dice.length === 0) return;

    let cX, cY;
    if (ring === -1) { cX = BOARD_CONFIG.centerX; cY = BOARD_CONFIG.centerY; }
    else {
        const cfg = BOARD_CONFIG.rings[ring];
        const step = 360 / cfg.count;
        const rad = (index * step - 90 + BOARD_CONFIG.rotation + step / 2) * Math.PI / 180;
        const r = (cfg.innerRadius + cfg.outerRadius) / 2;
        cX = BOARD_CONFIG.centerX + r * Math.cos(rad);
        cY = BOARD_CONFIG.centerY + r * Math.sin(rad);
    }

    dice.forEach((die, i) => {
        const off = (i - (dice.length - 1) / 2) * 15;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `die-container die-${die.color} ${die.isTiger ? 'die-tiger' : ''}`);
        g.setAttribute('data-field', fieldKey);
        g.setAttribute('transform', `translate(${cX + off - 15}, ${cY - 15})`);

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', 30); rect.setAttribute('height', 30); rect.setAttribute('class', 'die-bg');
        g.appendChild(rect);

        const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        t.setAttribute('x', 15); t.setAttribute('y', 15); t.setAttribute('text-anchor', 'middle'); t.setAttribute('class', 'die-text');

        const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        sub.setAttribute('x', 15); sub.setAttribute('y', 25); sub.setAttribute('text-anchor', 'middle'); sub.setAttribute('class', 'die-text die-subtext');

        if (die.isTiger) {
            t.textContent = '🐅'; t.classList.add('tiger-icon-svg');
            sub.textContent = die.direction === undefined ? 'S:6 M:1' : (die.direction === 1 ? '▶' : '◀');
            if (gameState.awaitingDirectionTiger && gameState.awaitingDirectionTiger.fieldKey === fieldKey && gameState.awaitingDirectionTiger.dieIdx === i) {
                renderTigerArrows(ring, index, fieldKey, i);
            }
        } else {
            t.textContent = die.strength;
            sub.textContent = `M:${die.movement}`;
        }
        g.appendChild(t);
        g.appendChild(sub);
        board.appendChild(g);
    });
}

function renderTigerArrows(ring, index, fieldKey, dieIdx) {
    if (ring === -1) return;
    const board = document.getElementById('game-board');
    const cfg = BOARD_CONFIG.rings[ring];
    const step = 360 / cfg.count;
    const base = (index * step - 90 + BOARD_CONFIG.rotation + step / 2);
    const arrowG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    arrowG.setAttribute('class', `tiger-arrow-group tiger-arrows-${fieldKey}`);

    const create = (ang, dir) => {
        const rad = ang * Math.PI / 180;
        const r = (cfg.innerRadius + cfg.outerRadius) / 2;
        const ax = BOARD_CONFIG.centerX + r * Math.cos(rad);
        const ay = BOARD_CONFIG.centerY + r * Math.sin(rad);
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const s = 30; const rot = ang + (dir === 1 ? 90 : -90);
        arrow.setAttribute('d', `M 0 -${s / 2} L ${s / 2} 0 L 0 ${s / 2} Z`);
        arrow.setAttribute('transform', `translate(${ax}, ${ay}) rotate(${rot})`);
        arrow.setAttribute('class', 'tiger-arrow');
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            setTigerDirection(fieldKey, dieIdx, dir);
        });
        arrowG.appendChild(arrow);
    };

    create(base + step / 2, 1);
    create(base - step / 2, -1);
    board.appendChild(arrowG);
}

function setTigerDirection(fieldKey, dieIdx, dir) {
    if (!gameState.stones[fieldKey]) return;
    gameState.stones[fieldKey][dieIdx].direction = dir;
    gameState.awaitingDirectionTiger = null;
    const [r, i] = fieldKey.split('-').map(Number);
    renderFieldDice(r, i);
    clearStoneSelection();
    switchTurn();
}

// ============================================
// BOARD GENERATION
// ============================================

function initializeBoard() {
    gameState.fields = [];
    const boardSVG = document.getElementById('game-board');
    if (!boardSVG) return;
    boardSVG.innerHTML = '';

    BOARD_CONFIG.rings.forEach((ring, ringIndex) => {
        const angleStep = 360 / ring.count;
        for (let i = 0; i < ring.count; i++) {
            const field = createField(ringIndex, i, angleStep, ring);
            gameState.fields.push(field);
        }
    });

    const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centerCircle.setAttribute('cx', BOARD_CONFIG.centerX);
    centerCircle.setAttribute('cy', BOARD_CONFIG.centerY);
    centerCircle.setAttribute('r', BOARD_CONFIG.centerRadius);
    centerCircle.setAttribute('class', 'center-circle');
    centerCircle.addEventListener('click', () => handleFieldClick(-1, 0));
    boardSVG.appendChild(centerCircle);

    gameState.fields.push({ ring: -1, index: 0, element: centerCircle });
}

function createField(ringIndex, fieldIndex, angleStep, ring) {
    const startAngle = fieldIndex * angleStep - 90 + BOARD_CONFIG.rotation;
    const endAngle = startAngle + angleStep;
    const path = createRoundedWedgePath(BOARD_CONFIG.centerX, BOARD_CONFIG.centerY, ring.innerRadius, ring.outerRadius, startAngle, endAngle);
    const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathElement.setAttribute('d', path);
    pathElement.setAttribute('class', 'field');
    pathElement.addEventListener('click', () => handleFieldClick(ringIndex, fieldIndex));
    const board = document.getElementById('game-board');
    if (board) board.appendChild(pathElement);
    return { ring: ringIndex, index: fieldIndex, element: pathElement };
}

function createRoundedWedgePath(cx, cy, innerRadius, outerRadius, startAngle, endAngle) {
    const toRadians = (angle) => (angle * Math.PI) / 180;
    const iS = { x: cx + innerRadius * Math.cos(toRadians(startAngle)), y: cy + innerRadius * Math.sin(toRadians(startAngle)) };
    const iE = { x: cx + innerRadius * Math.cos(toRadians(endAngle)), y: cy + innerRadius * Math.sin(toRadians(endAngle)) };
    const oS = { x: cx + outerRadius * Math.cos(toRadians(startAngle)), y: cy + outerRadius * Math.sin(toRadians(startAngle)) };
    const oE = { x: cx + outerRadius * Math.cos(toRadians(endAngle)), y: cy + outerRadius * Math.sin(toRadians(endAngle)) };
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${iS.x} ${iS.y} L ${oS.x} ${oS.y} A ${outerRadius} ${outerRadius} 0 ${large} 1 ${oE.x} ${oE.y} L ${iE.x} ${iE.y} A ${innerRadius} ${innerRadius} 0 ${large} 0 ${iS.x} ${iS.y} Z`.trim();
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeBoard();
    updateTurnUI();
    const status = `${gameState.currentTurn.charAt(0).toUpperCase() + gameState.currentTurn.slice(1)}'s turn. Select strength or click board unit.`;
    updateStatus(status);
});
