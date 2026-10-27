// PYRAMID GAME - Seven Wonders Series
// Game Design: Simon Allmer
// Fullscreen 3D Implementation

// ============================================
// CONSTANTS & PYRAMID STRUCTURE
// ============================================

function getPlayerOrder() {
    if (playerCount === 2) return ['white', 'black'];
    if (playerCount === 3) return ['white', 'red', 'black'];
    return ['white', 'red', 'black', 'blue'];
}

let PLAYER_COLORS;
let playerCount;

function getLevels() {
    if (playerCount <= 2) {
        return [
            { level: 0, size: 7, playableRim: true },
            { level: 1, size: 5, playableRim: true },
            { level: 2, size: 3, playableRim: true },
            { level: 3, size: 1, playableRim: false }
        ];
    } else {
        return [
            { level: 0, size: 9, playableRim: true },
            { level: 1, size: 7, playableRim: true },
            { level: 2, size: 5, playableRim: true },
            { level: 3, size: 3, playableRim: true },
            { level: 4, size: 1, playableRim: false }
        ];
    }
}

let LEVELS = getLevels();

// ============================================
// GAME STATE
// ============================================
let pyramid = [];
let currentPlayer = 'white';
let selectedStone = null;
let validMoves = [];
let gameState = 'SELECT_STONE';
let lastPush = null;
let isVsComputer = localStorage.getItem('pyramidVsComputer') === null ? true : localStorage.getItem('pyramidVsComputer') === 'true';
// Conquest mode: only the victory fields win. Attrition never decides the game —
// once nobody holds 4 stones any more it is a draw.
let isConquestMode = localStorage.getItem('pyramidConquestMode') === 'true';
let showHints = localStorage.getItem('pyramidShowHints') === null ? true : localStorage.getItem('pyramidShowHints') === 'true';
let isMoveInProgress = false; // Block input during move
let turnInProgress = false;

let aiLastMovedStone = null;
let aiConsecutiveMoveCount = 0;

let view3D = null;
let view2D = null;
let is3DMode = true;
let animatedStones = new Map();
let isMenuOpen = false;

// ============================================
// INITIALIZATION
// ============================================

playerCount = parseInt(localStorage.getItem('pyramidPlayerCount')) || 2;
PLAYER_COLORS = getPlayerOrder();

document.addEventListener('DOMContentLoaded', () => {
    initializePyramid();
    initializeUI();
    initializeViews();
});

function initializeUI() {
    const menuToggle = document.getElementById('menu-toggle');
    const sideMenu = document.getElementById('side-menu');
    const newGameBtn = document.getElementById('new-game-btn');
    const playerCountBtn = document.getElementById('player-count-btn');
    playerCountBtn.textContent = `Players: ${playerCount}`;
    updatePlayerCountUI();
    const opponentBtn = document.getElementById('opponent-btn');
    const rulesBtn = document.getElementById('rules-btn');
    const closeRulesBtn = document.getElementById('close-rules-btn');
    const closeRulesBtnBottom = document.getElementById('close-rules-btn-bottom');
    const rulesOverlay = document.getElementById('rules-overlay');
    const rulesModal = document.getElementById('rules-modal');
    const playAgainBtn = document.getElementById('play-again-btn');
    const viewToggleBtn = document.getElementById('view-toggle-btn');
    const closeFromMenuBtn = document.getElementById('close-from-menu-btn');

    menuToggle.addEventListener('click', () => {
        isMenuOpen = !isMenuOpen;
        menuToggle.classList.toggle('active', isMenuOpen);
        sideMenu.classList.toggle('open', isMenuOpen);
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (isMenuOpen && !sideMenu.contains(e.target) && !menuToggle.contains(e.target)) {
            isMenuOpen = false;
            menuToggle.classList.remove('active');
            sideMenu.classList.remove('open');
        }
    });

    closeFromMenuBtn.addEventListener('click', () => {
        isMenuOpen = false;
        menuToggle.classList.remove('active');
        sideMenu.classList.remove('open');
        rulesModal.classList.add('hidden');
    });

    viewToggleBtn.addEventListener('click', () => {
        showMessage('2D View coming soon!');
    });

    newGameBtn.addEventListener('click', () => {
        initializePyramid();
        if (view3D) view3D.updateStones();
        if (view2D) view2D.draw();
    });

    playerCountBtn.addEventListener('click', () => {
        playerCount = playerCount === 2 ? 4 : 2;
        playerCountBtn.textContent = `Players: ${playerCount}`;
        localStorage.setItem('pyramidPlayerCount', playerCount);
        location.reload();
    });

    const modeBtn = document.getElementById('mode-btn');
    const updateModeBtn = () => {
        modeBtn.textContent = isConquestMode ? 'Mode: Conquest' : 'Mode: Standard';
    };
    updateModeBtn();

    modeBtn.addEventListener('click', () => {
        isConquestMode = !isConquestMode;
        localStorage.setItem('pyramidConquestMode', isConquestMode);
        updateModeBtn();
        showMessage(isConquestMode
            ? 'Conquest: only the victory fields win.'
            : 'Standard: last player with 4+ stones wins.');
        updateUI();
    });

    const hintsBtn = document.getElementById('hints-btn');
    const updateHintsBtn = () => {
        if (hintsBtn) hintsBtn.textContent = showHints ? 'Hints: On' : 'Hints: Off';
    };
    updateHintsBtn();

    if (hintsBtn) hintsBtn.addEventListener('click', () => {
        showHints = !showHints;
        localStorage.setItem('pyramidShowHints', showHints);
        updateHintsBtn();
        if (view3D) {
            view3D.clearHover();
            view3D.updateIndicators();
        }
        showMessage(showHints
            ? 'Hints on: possible moves are marked, and lit up on hover.'
            : 'Hints off: no move markers.');
    });

    opponentBtn.addEventListener('click', () => {
        isVsComputer = !isVsComputer;
        localStorage.setItem('pyramidVsComputer', isVsComputer);
        opponentBtn.textContent = isVsComputer ? 'Opponent: Computer' : 'Opponent: Human';
        if (isVsComputer && currentPlayer === 'black' && gameState !== 'GAME_OVER') {
            setTimeout(makeAIMove, 600);
        }
    });
    
    opponentBtn.textContent = isVsComputer ? 'Opponent: Computer' : 'Opponent: Human';

    rulesBtn.addEventListener('click', () => {
        rulesModal.classList.remove('hidden');
    });

    const closeRules = () => {
        rulesModal.classList.add('hidden');
    };

    if (closeRulesBtn) closeRulesBtn.addEventListener('click', closeRules);
    if (closeRulesBtnBottom) closeRulesBtnBottom.addEventListener('click', closeRules);
    rulesOverlay.addEventListener('click', closeRules);

    playAgainBtn.addEventListener('click', () => {
        clearTimeout(winRevealTimer);
        document.getElementById('game-over-overlay').classList.add('hidden');
        initializePyramid();
        if (view3D) view3D.updateStones();
        if (view2D) view2D.draw();
    });

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Escape') {
            e.preventDefault();
            if (!rulesModal.classList.contains('hidden')) {
                rulesModal.classList.add('hidden');
            } else if (isMenuOpen) {
                isMenuOpen = false;
                menuToggle.classList.remove('active');
                sideMenu.classList.remove('open');
            }
        }
        if (e.code === 'Space') {
            e.preventDefault();
            // Toggle menu
            if (rulesModal.classList.contains('hidden')) {
                isMenuOpen = !isMenuOpen;
                menuToggle.classList.toggle('active', isMenuOpen);
                sideMenu.classList.toggle('open', isMenuOpen);
            }
        }
    });

    updateUI();
}

function updateViewMode() {
    // For now, 3D only - show "Coming Soon" message if they try to switch
    const viewToggleBtn = document.getElementById('view-toggle-btn');
    const canvas3d = document.getElementById('canvas-3d');
    const canvas2d = document.getElementById('canvas-2d');
    
    // Always use 3D mode for now
    is3DMode = true;
    viewToggleBtn.textContent = 'View: 3D';
    
    canvas3d.classList.remove('hidden');
    canvas2d.classList.add('hidden');
    if (view3D) {
        // The 3D view's method is onResize(), and its render loop is already
        // running from init() - starting a second one would double the work.
        view3D.onResize();
        if (!view3D.running) {
            view3D.running = true;
            view3D.animate();
        }
    }
}

function initializeViews() {
    const container3d = document.getElementById('canvas-3d');
    const container2d = document.getElementById('canvas-2d');
    
    console.log('Initializing views...');
    console.log('THREE defined:', typeof THREE !== 'undefined');
    console.log('OrbitControls defined:', typeof THREE !== 'undefined' && typeof THREE.OrbitControls !== 'undefined');
    
    // Initialize 2D first as fallback
    view2D = new PyramidView2D(container2d, {
        getPyramid: () => pyramid,
        getCurrentPlayer: () => currentPlayer,
        getSelectedStone: () => selectedStone,
        getValidMoves: () => validMoves,
        getGameState: () => gameState,
        onCellClick: handleCellClick
    });
    
    // Try to initialize 3D
    if (typeof THREE !== 'undefined') {
        try {
            view3D = new PyramidView3D(container3d, {
                getPyramid: () => pyramid,
                getCurrentPlayer: () => currentPlayer,
                getSelectedStone: () => selectedStone,
                getValidMoves: () => validMoves,
                getGameState: () => gameState,
                onCellClick: handleCellClick
            });
            console.log('3D view initialized successfully');
        } catch (e) {
            console.error('Failed to initialize 3D view:', e);
            // Fall back to 2D
            is3DMode = false;
        }
    } else {
        console.warn('Three.js not loaded, using 2D only');
        is3DMode = false;
    }
    
    updateViewMode();
}

function initializePyramid() {
    LEVELS = getLevels();
    pyramid = [];

    const highestPlayableLevel = LEVELS.filter(l => l.playableRim).pop().level;

    LEVELS.forEach(({ level, size, playableRim }) => {
        const grid = Array(size).fill(0).map(() =>
            Array(size).fill(0).map(() => ({ piece: null, playable: false, victory: false }))
        );

        if (playableRim) {
            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    if (r === 0 || r === size - 1 || c === 0 || c === size - 1) {
                        grid[r][c].playable = true;
                        if (level === highestPlayableLevel) {
                            if ((r === 0 && c === 0) || (r === 0 && c === size - 1) ||
                                (r === size - 1 && c === 0) || (r === size - 1 && c === size - 1)) {
                                grid[r][c].victory = true;
                            }
                        }
                    }
                }
            }
        }

        pyramid[level] = grid;
    });

    placeStartingStones();

    currentPlayer = 'white';
    selectedStone = null;
    validMoves = [];
    gameState = 'SELECT_STONE';
    lastPush = null;

    updateUI();
    if (view3D) view3D.updateStones();
    if (view2D) view2D.draw();
}

function placeStartingStones() {
    if (playerCount <= 2) {
        const groundLevel = 0;
        const size = LEVELS[groundLevel].size;
        for (let c = 0; c < 7; c++) {
            pyramid[groundLevel][size - 1][c].piece = 'white';
        }
        for (let c = 0; c < 7; c++) {
            pyramid[groundLevel][0][c].piece = 'black';
        }
    } else {
        const groundLevel = 0;
        const size = LEVELS[groundLevel].size;
        for (let c = 1; c <= 7; c++) {
            pyramid[groundLevel][size - 1][c].piece = 'white';
        }
        for (let c = 1; c <= 7; c++) {
            pyramid[groundLevel][0][c].piece = 'black';
        }
        for (let r = 1; r <= 7; r++) {
            pyramid[groundLevel][r][0].piece = 'red';
        }
        if (playerCount >= 4) {
            for (let r = 1; r <= 7; r++) {
                pyramid[groundLevel][r][size - 1].piece = 'blue';
            }
        }
    }
}

// ============================================
// UI UPDATES
// ============================================

function updatePlayerCountUI() {
    const redContainer = document.querySelector('.red-container');
    const blueContainer = document.querySelector('.blue-container');
    const sideMenu = document.getElementById('side-menu');
    
    if (redContainer) {
        redContainer.style.display = playerCount >= 3 ? 'flex' : 'none';
    }
    if (blueContainer) {
        blueContainer.style.display = playerCount >= 4 ? 'flex' : 'none';
    }
    
    if (sideMenu) {
        sideMenu.classList.toggle('four-players', playerCount >= 4);
    }
}

function updateUI() {
    updatePlayerCountUI();
    
    const playerIndicator = document.getElementById('player-indicator');
    const playerName = document.getElementById('player-name');
    const whiteCount = document.getElementById('white-count');
    const blackCount = document.getElementById('black-count');
    const redCount = document.getElementById('red-count');
    const blueCount = document.getElementById('blue-count');
    const topCount = document.getElementById('top-count');

    if (playerIndicator && playerName) {
        playerIndicator.className = 'player-indicator ' + currentPlayer;
        if (gameState !== 'GAME_OVER') {
            playerName.textContent = currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1) + "'s Turn";
        }
    }

    const counts = { white: 0, black: 0, red: 0, blue: 0 };
    let victory = 0;
    
    pyramid.forEach((grid, level) => {
        grid.forEach(row => {
            row.forEach(cell => {
                if (counts.hasOwnProperty(cell.piece)) {
                    counts[cell.piece]++;
                    if (cell.victory) victory++;
                }
            });
        });
    });

    if (whiteCount) whiteCount.textContent = counts.white;
    if (blackCount) blackCount.textContent = counts.black;
    if (redCount) redCount.textContent = counts.red;
    if (blueCount) blueCount.textContent = counts.blue;
    if (topCount) topCount.textContent = victory + '/4';

    checkWinConditions(counts, victory);
}

function checkWinConditions(counts, victoryStones) {
    const highestPlayableLevel = LEVELS.filter(l => l.playableRim).pop().level;
    const victoryLevel = highestPlayableLevel;
    const victorySize = LEVELS[victoryLevel].size;
    
    const victoryPositions = [
        { level: victoryLevel, row: 0, col: 0 },
        { level: victoryLevel, row: 0, col: victorySize - 1 },
        { level: victoryLevel, row: victorySize - 1, col: 0 },
        { level: victoryLevel, row: victorySize - 1, col: victorySize - 1 }
    ];
    
    const victoryByColor = { white: 0, black: 0, red: 0, blue: 0 };
    
    victoryPositions.forEach(pos => {
        const piece = pyramid[pos.level]?.[pos.row]?.[pos.col]?.piece;
        if (victoryByColor.hasOwnProperty(piece)) {
            victoryByColor[piece]++;
        }
    });
    
    for (let i = 0; i < playerCount; i++) {
        const color = PLAYER_COLORS[i];
        if (victoryByColor[color] === 4) {
            gameState = 'GAME_OVER';
            showGameOver(color.charAt(0).toUpperCase() + color.slice(1) + ' Wins!', 
                color.charAt(0).toUpperCase() + color.slice(1) + ' controls all victory fields!');
            return;
        }
    }
    
    const activePlayers = PLAYER_COLORS.slice(0, playerCount);
    const playersBelowFour = activePlayers.filter(color => counts[color] < 4);
    
    if (playersBelowFour.length === playerCount) {
        gameState = 'GAME_OVER';
        showGameOver('Draw!', 'All players have fewer than 4 stones.');
    } else if (!isConquestMode && playersBelowFour.length === playerCount - 1) {
        const winner = activePlayers.find(c => !playersBelowFour.includes(c));
        if (winner) {
            gameState = 'GAME_OVER';
            showGameOver(winner.charAt(0).toUpperCase() + winner.slice(1) + ' Wins!', 
                playersBelowFour[0].charAt(0).toUpperCase() + playersBelowFour[0].slice(1) + ' has fewer than 4 stones.');
        }
    }
}

var winRevealTimer = null;
function showGameOver(title, text) {
    const overlay = document.getElementById('game-over-overlay');
    const titleEl = document.getElementById('game-over-title');
    const textEl = document.getElementById('game-over-text');
    
    titleEl.textContent = title;
    textEl.textContent = text;
    // let the final move play out before covering the board
    clearTimeout(winRevealTimer);
    winRevealTimer = setTimeout(() => overlay.classList.remove('hidden'), 1100);
}

function showMessage(text) {
    const msgBox = document.getElementById('game-message');
    msgBox.textContent = text;
    msgBox.classList.remove('hidden');
    clearTimeout(window.messageTimeout);
    window.messageTimeout = setTimeout(() => {
        msgBox.classList.add('hidden');
    }, 3500);
}

// ============================================
// GAME LOGIC
// ============================================

function isPlayable(level, row, col) {
    if (level < 0 || level >= pyramid.length) return false;
    const grid = pyramid[level];
    if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) return false;
    // Top level (single cell) is always accessible via jump
    if (LEVELS[level].size === 1) return true;
    return grid[row][col].playable;
}

function calculateRunMoves(level, row, col) {
    const moves = [];
    const directions = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
    const baseSize = LEVELS[0].size;

    directions.forEach(({ dr, dc }) => {
        let currentLevel = level;
        let r = row;
        let c = col;

        while (true) {
            let nextR = r + dr;
            let nextC = c + dc;
            let nextLevel = currentLevel;

            if (!isPlayable(currentLevel, nextR, nextC)) {
                if (currentLevel > 0) {
                    nextLevel = currentLevel - 1;
                    const currentOffset = (baseSize - LEVELS[currentLevel].size) / 2;
                    const nextOffset = (baseSize - LEVELS[nextLevel].size) / 2;
                    const globalR = r + currentOffset;
                    const globalC = c + currentOffset;
                    const targetGlobalR = globalR + dr;
                    const targetGlobalC = globalC + dc;
                    nextR = targetGlobalR - nextOffset;
                    nextC = targetGlobalC - nextOffset;
                } else {
                    break;
                }
            }

            if (isPlayable(nextLevel, nextR, nextC)) {
                if (pyramid[nextLevel][nextR][nextC].piece) {
                    if (nextLevel < currentLevel) {
                        moves.push({ level: nextLevel, row: nextR, col: nextC, type: 'smash' });
                    }
                    break;
                } else {
                    moves.push({ level: nextLevel, row: nextR, col: nextC, type: 'run' });
                    currentLevel = nextLevel;
                    r = nextR;
                    c = nextC;
                }
            } else {
                break;
            }
        }
    });

    return moves;
}

function calculateJumpMoves(level, row, col) {
    const moves = [];
    const highestLevel = LEVELS.length - 1;
    if (level >= highestLevel) return moves;

    const upperLevel = level + 1;
    const upperSize = LEVELS[upperLevel].size;
    const currentSize = LEVELS[level].size;
    const offset = (currentSize - upperSize) / 2;

    const directions = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

    directions.forEach(({ dr, dc }) => {
        const adjR = row + dr;
        const adjC = col + dc;
        const upperR = adjR - offset;
        const upperC = adjC - offset;

        if (isPlayable(upperLevel, upperR, upperC) && !pyramid[upperLevel][upperR][upperC].piece) {
            moves.push({ level: upperLevel, row: upperR, col: upperC, type: 'jump' });
        }
    });

    return moves;
}

function calculatePushMoves(level, row, col) {
    const moves = [];
    const directions = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];

    directions.forEach(({ dr, dc }) => {
        const adjR = row + dr;
        const adjC = col + dc;

        if (isPlayable(level, adjR, adjC) && pyramid[level][adjR][adjC].piece) {
            const pushR = adjR + dr;
            const pushC = adjC + dc;

            if (isPlayable(level, pushR, pushC)) {
                if (!pyramid[level][pushR][pushC].piece) {
                    let isPushBack = false;
                    if (lastPush) {
                        const amIThePushedOne = (level === lastPush.pushed.level && row === lastPush.pushed.row && col === lastPush.pushed.col);
                        const isTargetThePusher = (level === lastPush.pusher.level && adjR === lastPush.pusher.row && adjC === lastPush.pusher.col);
                        if (amIThePushedOne && isTargetThePusher) isPushBack = true;
                    }

                    if (!isPushBack) {
                        moves.push({
                            level, row: adjR, col: adjC, type: 'push',
                            pushTo: { level, row: pushR, col: pushC }
                        });
                    }
                }
            } else {
                if (level > 0) {
                    const lowerLevel = level - 1;
                    const offset = (LEVELS[lowerLevel].size - LEVELS[level].size) / 2;
                    const lowerPushR = pushR + offset;
                    const lowerPushC = pushC + offset;

                    if (isPlayable(lowerLevel, lowerPushR, lowerPushC)) {
                        moves.push({
                            level, row: adjR, col: adjC, type: 'push',
                            pushTo: { level: lowerLevel, row: lowerPushR, col: lowerPushC }
                        });
                    }
                } else {
                    moves.push({
                        level, row: adjR, col: adjC, type: 'push-fall',
                        pushTo: null
                    });
                }
            }
        }
    });

    return moves;
}

function handleCellClick(level, row, col) {
    // Block if game over, animating, or move in progress
    if (gameState === 'GAME_OVER') return;
    if (animatedStones.size > 0) return;
    if (isMoveInProgress) return;
    
    // In 2-player vs computer, only human color can click
    if (playerCount === 2 && isVsComputer && currentPlayer !== 'white') return;

    const cellData = pyramid[level][row][col];

    // In SELECT_STONE state, only allow clicking own stones
    // In SELECT_MOVE state, allow clicking valid move destinations (even opponent stones)
    if (gameState === 'SELECT_STONE') {
        if (cellData.piece && cellData.piece !== currentPlayer) {
            return;
        }
    }

    if (gameState === 'SELECT_STONE') {
        if (cellData.piece === currentPlayer) {
            selectedStone = { level, row, col };
            const runMoves = calculateRunMoves(level, row, col);
            const jumpMoves = calculateJumpMoves(level, row, col);
            const pushMoves = calculatePushMoves(level, row, col);
            validMoves = [...runMoves, ...jumpMoves, ...pushMoves];

            if (validMoves.length === 0) {
                showMessage("This stone has no valid moves.");
                selectedStone = null;
                return;
            }

            gameState = 'SELECT_MOVE';
            if (view3D) view3D.updateIndicators();
            if (view2D) view2D.draw();
        }
    } else if (gameState === 'SELECT_MOVE') {
        // Check if clicking on the same selected stone - deselect
        if (selectedStone && selectedStone.level === level && selectedStone.row === row && selectedStone.col === col) {
            selectedStone = null;
            validMoves = [];
            gameState = 'SELECT_STONE';
            if (view3D) view3D.updateIndicators();
            if (view2D) view2D.draw();
            return;
        }

        const move = validMoves.find(m => m.level === level && m.row === row && m.col === col);

        if (move) {
            executeMove(move);
        } else if (cellData.piece === currentPlayer) {
            // Clicking on own stone - switch selection
            selectedStone = { level, row, col };
            const runMoves = calculateRunMoves(level, row, col);
            const jumpMoves = calculateJumpMoves(level, row, col);
            const pushMoves = calculatePushMoves(level, row, col);
            validMoves = [...runMoves, ...jumpMoves, ...pushMoves];

            if (validMoves.length === 0) {
                showMessage("This stone has no valid moves.");
                selectedStone = null;
                validMoves = [];
                gameState = 'SELECT_STONE';
            }

            if (view3D) view3D.updateIndicators();
            if (view2D) view2D.draw();
        } else {
            // Clicking elsewhere - deselect
            selectedStone = null;
            validMoves = [];
            gameState = 'SELECT_STONE';
            if (view3D) view3D.updateIndicators();
            if (view2D) view2D.draw();
        }
    }
}

function executeMove(move) {
    isMoveInProgress = true; // Block input while processing move
    
    const fromPiece = pyramid[selectedStone.level][selectedStone.row][selectedStone.col].piece;
    const fromKey = `${selectedStone.level},${selectedStone.row},${selectedStone.col}`;
    const toKey = `${move.level},${move.row},${move.col}`;

    if (currentPlayer === 'black') {
        if (aiLastMovedStone &&
            aiLastMovedStone.level === selectedStone.level &&
            aiLastMovedStone.row === selectedStone.row &&
            aiLastMovedStone.col === selectedStone.col) {
            aiConsecutiveMoveCount++;
        } else {
            aiConsecutiveMoveCount = 1;
        }
        aiLastMovedStone = { level: move.level, row: move.row, col: move.col };
    } else {
        aiLastMovedStone = null;
        aiConsecutiveMoveCount = 0;
    }

    // Animate the move in 3D
    if (is3DMode && view3D && animatedStones.size === 0) {
        const stoneForAnimation = selectedStone;
        const finish = () => {
            selectedStone = stoneForAnimation;
            performMoveLogic(move, fromPiece);
        };
        const dir = {
            dr: Math.sign(move.row - selectedStone.row),
            dc: Math.sign(move.col - selectedStone.col)
        };

        if (move.type === 'push') {
            if (view3D.stoneMeshes.has(toKey)) {
                const pushToKey = `${move.pushTo.level},${move.pushTo.row},${move.pushTo.col}`;
                // A push over the edge drops onto the level below and smashes
                // whatever stands there.
                if (move.pushTo.level < move.level) {
                    view3D.destroyStone(pushToKey, 'smash', dir);
                }
                // The stone being shoved moves first, then the pusher follows.
                view3D.animateStone(toKey, pushToKey, { to: move.pushTo, style: 'push' }, () => {
                    setTimeout(() => {
                        view3D.animateStone(fromKey, toKey, { to: move, style: 'move' }, finish);
                    }, 100);
                });
            } else {
                finish();
            }
        } else if (move.type === 'smash' || move.type === 'push-fall') {
            // The stone standing on the target field is the one that leaves;
            // the moving stone takes its place.
            view3D.destroyStone(toKey, move.type === 'smash' ? 'smash' : 'fall', dir);
            view3D.animateStone(fromKey, toKey, { to: move, style: 'move' }, finish);
        } else {
            view3D.animateStone(fromKey, toKey, { to: move, style: 'move' }, finish);
        }
    } else {
        performMoveLogic(move, fromPiece);
    }
}

function performMoveLogic(move, fromPiece) {
    if (move.type === 'run' || move.type === 'jump') {
        pyramid[move.level][move.row][move.col].piece = fromPiece;
        pyramid[selectedStone.level][selectedStone.row][selectedStone.col].piece = null;
        lastPush = null;
    } else if (move.type === 'smash') {
        const smashedPiece = pyramid[move.level][move.row][move.col].piece;
        pyramid[move.level][move.row][move.col].piece = fromPiece;
        pyramid[selectedStone.level][selectedStone.row][selectedStone.col].piece = null;
        lastPush = null;
    } else if (move.type === 'push') {
        const pushedPiece = pyramid[move.level][move.row][move.col].piece;
        const targetPiece = pyramid[move.pushTo.level][move.pushTo.row][move.pushTo.col].piece;

        pyramid[move.pushTo.level][move.pushTo.row][move.pushTo.col].piece = pushedPiece;
        pyramid[move.level][move.row][move.col].piece = fromPiece;
        pyramid[selectedStone.level][selectedStone.row][selectedStone.col].piece = null;

        lastPush = {
            pusher: { level: move.level, row: move.row, col: move.col },
            pushed: { level: move.pushTo.level, row: move.pushTo.row, col: move.pushTo.col }
        };

        if (move.pushTo.level < move.level) {
            if (targetPiece) {
                showMessage(`DROP and SMASH!`);
            } else {
                showMessage(`DROP to lower level!`);
            }
        }
    } else if (move.type === 'push-fall') {
        pyramid[move.level][move.row][move.col].piece = fromPiece;
        pyramid[selectedStone.level][selectedStone.row][selectedStone.col].piece = null;
        showMessage(`FALL! Stone pushed off!`);
        lastPush = null;
    }

    checkAndRemoveOsiris();
    endTurn();
}

function checkAndRemoveOsiris() {
    const captured = [];
    const attackers = [];

    const scanLine = (pieces, map) => {
        PLAYER_COLORS.slice(0, playerCount).forEach(color => {
            const result = checkLine(pieces, map, color);
            captured.push(...result.captured);
            attackers.push(...result.attackers);
        });
    };

    LEVELS.forEach(({ level, size }) => {
        const grid = pyramid[level];
        const gridMap = [];

        for (let r = 0; r < size; r++) {
            const rowMap = [];
            for (let c = 0; c < size; c++) {
                rowMap.push({ level, row: r, col: c });
            }
            gridMap.push(rowMap);
        }

        for (let r = 0; r < size; r++) {
            scanLine(grid[r].map(cell => cell.piece), gridMap[r]);
        }

        for (let c = 0; c < size; c++) {
            const colPieces = [];
            const colMap = [];
            for (let r = 0; r < size; r++) {
                colPieces.push(grid[r][c].piece);
                colMap.push(gridMap[r][c]);
            }
            scanLine(colPieces, colMap);
        }
    });

    const dedupe = (list) => {
        const seen = new Set();
        const out = [];
        list.forEach(s => {
            if (!s) return;
            const key = `${s.level},${s.row},${s.col}`;
            if (!seen.has(key)) {
                seen.add(key);
                out.push(s);
            }
        });
        return out;
    };

    const uniqueStones = dedupe(captured);
    if (uniqueStones.length === 0) return;

    showMessage(`Osiris! ${uniqueStones.length} stones captured!`);

    // Apply the capture to the board IMMEDIATELY. The turn carries on while
    // the animation plays, so deferring the removal until the animation ends
    // let the next player (and the AI) act on stones that were already gone.
    const meshes = (view3D && is3DMode) ? view3D.detachStones(uniqueStones) : [];
    uniqueStones.forEach(({ level, row, col }) => {
        pyramid[level][row][col].piece = null;
    });

    if (view3D && is3DMode) {
        view3D.playOsirisAnimation(uniqueStones, dedupe(attackers), meshes);
    }

    updateUI();
}

function checkLine(line, map, attackerColor) {
    const captured = [];
    const attackers = [];
    const attackerIndices = [];
    line.forEach((p, i) => {
        if (p === attackerColor) attackerIndices.push(i);
    });

    for (let i = 0; i < attackerIndices.length - 1; i++) {
        const start = attackerIndices[i];
        const end = attackerIndices[i + 1];

        if (end > start + 1) {
            // Every field between the two flanking stones must hold an enemy
            // stone — a single empty field breaks the line, so no Osiris.
            let unbroken = true;
            for (let k = start + 1; k < end; k++) {
                if (!line[k]) {
                    unbroken = false;
                    break;
                }
            }

            if (unbroken) {
                for (let k = start + 1; k < end; k++) {
                    captured.push(map[k]);
                }
                attackers.push(map[start], map[end]);
            }
        }
    }
    return { captured, attackers };
}

function capitalize(color) {
    return color.charAt(0).toUpperCase() + color.slice(1);
}

function collectMovesFor(color) {
    const actions = [];
    pyramid.forEach((grid, level) => {
        grid.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (cell.piece === color) {
                    const moves = [
                        ...calculateRunMoves(level, r, c),
                        ...calculateJumpMoves(level, r, c),
                        ...calculatePushMoves(level, r, c)
                    ];
                    moves.forEach(move => actions.push({ stone: { level, row: r, col: c }, move }));
                }
            });
        });
    });
    return actions;
}

function endTurn() {
    selectedStone = null;
    validMoves = [];
    
    // Move to next player
    const currentIndex = PLAYER_COLORS.indexOf(currentPlayer);
    const nextIndex = (currentIndex + 1) % playerCount;
    currentPlayer = PLAYER_COLORS[nextIndex];

    // A player with nothing to move is skipped, not stuck. Only when nobody
    // can move at all is the game actually over.
    let skipped = 0;
    while (skipped < playerCount && collectMovesFor(currentPlayer).length === 0) {
        showMessage(`${capitalize(currentPlayer)} has no legal move and is skipped.`);
        currentPlayer = PLAYER_COLORS[(PLAYER_COLORS.indexOf(currentPlayer) + 1) % playerCount];
        skipped++;
    }

    gameState = 'SELECT_STONE';
    updateUI();

    if (skipped >= playerCount && gameState !== 'GAME_OVER') {
        gameState = 'GAME_OVER';
        showGameOver('Draw!', 'No player has a legal move left.');
    }

    if (view3D) {
        view3D.updateStones();
        view3D.updateIndicators();
    }
    if (view2D) {
        view2D.draw();
    }

    // AI only in multiplayer when vsComputer is on
    const isAITurn = (playerCount > 2 && isVsComputer && currentPlayer !== 'white') || 
                     (playerCount === 2 && isVsComputer && currentPlayer === 'black');
    
    if (isAITurn && gameState !== 'GAME_OVER') {
        setTimeout(() => {
            makeAIMove();
        }, 500);
    } else {
        isMoveInProgress = false;
    }
}

// ============================================
// AI LOGIC
// ============================================

function makeAIMove() {
    if (gameState === 'GAME_OVER') return;
    if (currentPlayer === 'white') return;
    
    const allPossibleMoves = collectMovesFor(currentPlayer);

    if (allPossibleMoves.length === 0) {
        // Boxed in - pass the turn along instead of ending the game.
        endTurn();
        return;
    }

    let bestMove = null;
    let bestScore = -Infinity;

    allPossibleMoves.forEach(action => {
        let score = 0;
        const { stone, move } = action;
        const highestPlayableLevel = LEVELS.filter(l => l.playableRim).pop().level;
        const opponentColors = PLAYER_COLORS.filter(c => c !== currentPlayer);

        if (move.type === 'smash') {
            const smashedPiece = pyramid[move.level][move.row][move.col].piece;
            if (opponentColors.includes(smashedPiece)) score += 150;
            else if (smashedPiece === currentPlayer) score -= 500;
        }

        if (move.type === 'push-fall') {
            const pushedPiece = pyramid[move.level][move.row][move.col].piece;
            if (opponentColors.includes(pushedPiece)) score += 150;
            else if (pushedPiece === currentPlayer) score -= 500;
        } else if (move.type === 'push') {
            const pushedPiece = pyramid[move.level][move.row][move.col].piece;
            const targetPiece = pyramid[move.pushTo.level][move.pushTo.row][move.pushTo.col].piece;

            if (opponentColors.includes(pushedPiece)) {
                score += 30;
                if (move.pushTo.level < move.level && opponentColors.includes(targetPiece)) score -= 400;
                else if (move.pushTo.level < move.level && targetPiece === currentPlayer) score += 100;
            } else if (pushedPiece === currentPlayer) {
                score -= 60;
                if (move.pushTo.level < move.level && opponentColors.includes(targetPiece)) score -= 500;
                else if (move.pushTo.level < move.level && targetPiece === currentPlayer) score -= 100;
            }
        }

        if (move.level === highestPlayableLevel + 1) {
            score += 10000;
        } else if (move.level > stone.level || move.type === 'jump') {
            score += 40 * move.level;
        } else if (move.level < stone.level && move.type !== 'smash' && move.type !== 'push') {
            score -= 20;
        }

        if (move.level < highestPlayableLevel) {
            const center = LEVELS[move.level].size / 2 - 0.5;
            const dist = Math.abs(move.row - center) + Math.abs(move.col - center);
            score += (5 - dist) * 2;
        }

        if (move.level === highestPlayableLevel) {
            const victorySize = LEVELS[highestPlayableLevel].size;
            if ((move.row === 0 && move.col === 0) || (move.row === 0 && move.col === victorySize - 1) ||
                (move.row === victorySize - 1 && move.col === 0) || (move.row === victorySize - 1 && move.col === victorySize - 1)) {
                score += 1000;
            }
        }

        score += Math.random() * 10;

        if (aiLastMovedStone &&
            aiLastMovedStone.level === stone.level &&
            aiLastMovedStone.row === stone.row &&
            aiLastMovedStone.col === stone.col) {
            if (aiConsecutiveMoveCount >= 2) score -= 200;
            else if (aiConsecutiveMoveCount >= 1) score -= 30;
        }

        if (score > bestScore) {
            bestScore = score;
            bestMove = action;
        }
    });

    if (bestMove) {
        selectedStone = bestMove.stone;
        executeMove(bestMove.move);
    }
}

// ============================================
// 3D VIEW IMPLEMENTATION
// ============================================

class PyramidView3D {
    constructor(container, gameInterface) {
        this.container = container;
        this.game = gameInterface;
        this.cellMeshes = new Map();
        this.stoneMeshes = new Map();
        this.indicatorMeshes = [];
        this.init();
    }

    init() {
        // Check if Three.js is loaded
        if (typeof THREE === 'undefined') {
            console.error('Three.js not loaded!');
            return;
        }
        
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1510);
        this.scene.fog = new THREE.Fog(0x1a1510, 25, 120);

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
                this.camera.position.set(8, 10, 8);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x1a1510);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.container.appendChild(this.renderer.domElement);

        // Check if OrbitControls is available
        if (typeof THREE.OrbitControls !== 'undefined') {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.enablePan = false; // Disable panning - only rotate and zoom
            this.controls.target.set(0, 1.0, 0);
            this.controls.minDistance = 8;
            this.controls.maxDistance = 45;
            this.controls.maxPolarAngle = Math.PI * 0.48;
        } else {
            console.warn('OrbitControls not available, using simple camera');
            this.controls = null;
        }

        this.setupLights();
        this.createDesertEnvironment();
        this.createPyramid();
        this.setupRaycaster();
        this.setupKeyboard();
        this.running = true;
        
        window.addEventListener('resize', () => this.onResize());
        
        this.animate();
    }

    setupLights() {
        this.scene.fog = new THREE.FogExp2(0xc9a86c, 0.015);

        const ambient = new THREE.AmbientLight(0xffeedd, 0.3);
        this.scene.add(ambient);

        const hemi = new THREE.HemisphereLight(0xffddaa, 0x443322, 0.6);
        this.scene.add(hemi);

        const sun = new THREE.DirectionalLight(0xfff5e0, 1.8);
        sun.position.set(25, 35, 15);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 100;
        sun.shadow.camera.left = -30;
        sun.shadow.camera.right = 30;
        sun.shadow.camera.top = 30;
        sun.shadow.camera.bottom = -30;
        sun.shadow.bias = -0.0005;
        this.scene.add(sun);

        const fill = new THREE.DirectionalLight(0x8888aa, 0.4);
        fill.position.set(-15, 10, -15);
        this.scene.add(fill);
        
        const rim = new THREE.DirectionalLight(0xffaa66, 0.5);
        rim.position.set(-20, 5, 20);
        this.scene.add(rim);
    }

    createDesertEnvironment() {
        const groundGeo = new THREE.PlaneGeometry(200, 200, 40, 40);
        const vertices = groundGeo.attributes.position.array;
        for (let i = 0; i < vertices.length; i += 3) {
            vertices[i + 2] += Math.random() * 0.2 - 0.1;
        }
        groundGeo.computeVertexNormals();

        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x8b7355,
            roughness: 0.9,
            metalness: 0.0,
            flatShading: true
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.05;
        ground.receiveShadow = true;
        this.scene.add(ground);

        for (let i = 0; i < 150; i++) {
            const size = Math.random() * 0.4 + 0.1;
            const rockGeo = new THREE.DodecahedronGeometry(size, 0);
            const rockMat = new THREE.MeshStandardMaterial({
                color: Math.random() > 0.5 ? 0xc9a86c : 0xa08050,
                roughness: 0.95,
                flatShading: true
            });
            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.castShadow = true;
            rock.receiveShadow = true;
            const angle = Math.random() * Math.PI * 2;
            const dist = 12 + Math.random() * 70;
            rock.position.set(
                Math.cos(angle) * dist,
                size * 0.3,
                Math.sin(angle) * dist
            );
            rock.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            this.scene.add(rock);
        }

        for (let i = 0; i < 12; i++) {
            const width = 8 + Math.random() * 15;
            const duneGeo = new THREE.SphereGeometry(width, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
            const duneMat = new THREE.MeshStandardMaterial({
                color: 0xb8956a,
                roughness: 1.0,
                flatShading: true
            });
            const dune = new THREE.Mesh(duneGeo, duneMat);
            dune.receiveShadow = true;
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 50;
            dune.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
            dune.scale.y = (2 + Math.random() * 3) / width * 0.25;
            this.scene.add(dune);
        }

        for (let i = 0; i < 4; i++) {
            const size = 4 + Math.random() * 8;
            const pyramidGeo = new THREE.ConeGeometry(size, size * 0.75, 4);
            const pyramidMat = new THREE.MeshStandardMaterial({
                color: 0x6b5545,
                roughness: 0.85,
                flatShading: true
            });
            const distantPyramid = new THREE.Mesh(pyramidGeo, pyramidMat);
            distantPyramid.castShadow = true;
            distantPyramid.receiveShadow = true;
            const angle = Math.random() * Math.PI * 2;
            const dist = 45 + Math.random() * 35;
            distantPyramid.position.set(
                Math.cos(angle) * dist,
                size * 0.375,
                Math.sin(angle) * dist
            );
            distantPyramid.rotation.y = Math.random() * Math.PI;
            this.scene.add(distantPyramid);
        }
    }

    createPyramid() {
        const levelHeight = 0.6;
        const cellSize = 1.0;

        LEVELS.forEach(({ level, size }) => {
            const levelOffset = (size - 1) / 2;
            const y = level * levelHeight;

            const basePlateGeo = new THREE.BoxGeometry(size * cellSize - 0.05, 0.1, size * cellSize - 0.05);
            const basePlateMat = new THREE.MeshStandardMaterial({
                color: 0x8a7862,
                roughness: 0.95,
                metalness: 0.0
            });
            const basePlate = new THREE.Mesh(basePlateGeo, basePlateMat);
            basePlate.position.set(0, y - 0.05, 0);
            basePlate.receiveShadow = true;
            this.scene.add(basePlate);

            for (let r = 0; r < size; r++) {
                for (let c = 0; c < size; c++) {
                    const x = (c - levelOffset) * cellSize;
                    const z = (r - levelOffset) * cellSize;

                    const cellGeo = new THREE.BoxGeometry(cellSize * 0.98, levelHeight * 1.0, cellSize * 0.98);
                    const cellMat = new THREE.MeshStandardMaterial({
                        color: 0xb8a080,
                        roughness: 0.8,
                        metalness: 0.05
                    });
                    const cellMesh = new THREE.Mesh(cellGeo, cellMat);
                    cellMesh.position.set(x, y, z);
                    cellMesh.receiveShadow = true;
                    cellMesh.castShadow = true;
                    cellMesh.userData = { level, row: r, col: c };
                    this.scene.add(cellMesh);
                    this.cellMeshes.set(`${level},${r},${c}`, cellMesh);

                    // Add victory field indicator on the highest playable level corners
                    const highestPlayableLevel = LEVELS.filter(l => l.playableRim).pop().level;
                    const victorySize = LEVELS[highestPlayableLevel].size;
                    const isVictory = (level === highestPlayableLevel && r === 0 && c === 0) ||
                                      (level === highestPlayableLevel && r === 0 && c === victorySize - 1) ||
                                      (level === highestPlayableLevel && r === victorySize - 1 && c === 0) ||
                                      (level === highestPlayableLevel && r === victorySize - 1 && c === victorySize - 1);
                    
                    if (isVictory) {
                        const ringGeo = new THREE.RingGeometry(0.28, 0.42, 24);
                        const ringMat = new THREE.MeshBasicMaterial({
                            color: 0x60a5fa,
                            side: THREE.DoubleSide,
                            transparent: true,
                            opacity: 0.8
                        });
                        const ring = new THREE.Mesh(ringGeo, ringMat);
                        ring.rotation.x = -Math.PI / 2;
                        ring.position.set(x, y + levelHeight * 0.52, z);
                        this.scene.add(ring);
                    }
                }
            }
        });

        this.updateStones();
    }

    getWorldPosition(level, row, col) {
        const levelHeight = 0.6;
        const cellSize = 1.0;
        const size = LEVELS[level].size;
        const levelOffset = (size - 1) / 2;
        const y = level * levelHeight + levelHeight * 0.5;
        const x = (col - levelOffset) * cellSize;
        const z = (row - levelOffset) * cellSize;
        return new THREE.Vector3(x, y, z);
    }

    updateStones() {
        // A tinted mesh may be about to be removed or recoloured, and its
        // saved original would then be restored onto the wrong stone - or
        // never at all. Drop the highlight before the board changes under it.
        this.clearHover();

        const pyramid = this.game.getPyramid();
        
        this.stoneMeshes.forEach((mesh, key) => {
            const [level, row, col] = key.split(',').map(Number);
            const cell = pyramid[level]?.[row]?.[col];
            if (!cell || !cell.piece) {
                this.scene.remove(mesh);
                this.stoneMeshes.delete(key);
            }
        });

        pyramid.forEach((grid, level) => {
            grid.forEach((row, r) => {
                row.forEach((cell, c) => {
                    if (cell.piece) {
                        const key = `${level},${r},${c}`;
                        const existing = this.stoneMeshes.get(key);

                        // A mesh is keyed by its field, so a field that changed
                        // owner has to be rebuilt - otherwise the old colour
                        // keeps standing there as a ghost.
                        if (existing && existing.userData.color !== cell.piece) {
                            this.scene.remove(existing);
                            this.stoneMeshes.delete(key);
                        }

                        if (!this.stoneMeshes.has(key)) {
                            const stoneMesh = this.createStoneMesh(cell.piece);
                            const pos = this.getWorldPosition(level, r, c);
                            stoneMesh.position.copy(pos);
                            stoneMesh.userData = { level, row: r, col: c, color: cell.piece };
                            this.scene.add(stoneMesh);
                            this.stoneMeshes.set(key, stoneMesh);
                        } else {
                            const mesh = this.stoneMeshes.get(key);
                            const pos = this.getWorldPosition(level, r, c);
                            mesh.userData = { level, row: r, col: c, color: cell.piece };
                            if (!animatedStones.has(key)) {
                                mesh.position.copy(pos);
                            }
                        }
                    }
                });
            });
        });
    }

    createStoneMesh(color) {
        const group = new THREE.Group();
        
        let stoneColor;
        switch(color) {
            case 'white': stoneColor = 0xf8f8f8; break;
            case 'black': stoneColor = 0x2a2a2a; break;
            case 'red': stoneColor = 0xcc3333; break;
            case 'blue': stoneColor = 0x3366cc; break;
            default: stoneColor = 0xf8f8f8;
        }
        
        const bodyGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.45, 24);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: stoneColor,
            roughness: 0.25,
            metalness: 0.3,
            envMapIntensity: 0.5
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        
        const topGeo = new THREE.SphereGeometry(0.32, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const top = new THREE.Mesh(topGeo, bodyMat);
        top.position.y = 0.225;
        top.castShadow = true;
        group.add(top);

        const bevelGeo = new THREE.TorusGeometry(0.32, 0.025, 12, 32);
        const bevelMat = new THREE.MeshStandardMaterial({
            color: 0xD4AF37,
            roughness: 0.2,
            metalness: 0.8,
            emissive: 0x332200,
            emissiveIntensity: 0.1
        });
        const bevel = new THREE.Mesh(bevelGeo, bevelMat);
        bevel.rotation.x = Math.PI / 2;
        bevel.position.y = 0.22;
        bevel.castShadow = true;
        group.add(bevel);

        return group;
    }

    updateIndicators() {
        this.indicatorMeshes.forEach(mesh => {
            this.scene.remove(mesh);
        });
        this.indicatorMeshes = [];

        if (!showHints) return;

        const validMoves = this.game.getValidMoves();
        const selectedStone = this.game.getSelectedStone();
        
        if (!selectedStone || validMoves.length === 0) return;

        validMoves.forEach(move => {
            // A drop to a lower level kills whatever stands there, so it
            // reads as deadly too.
            const isDeadly = move.type === 'smash' || move.type === 'push-fall' ||
                            (move.type === 'push' && move.pushTo && move.pushTo.level < move.level);

            const currentPlayer = this.game.getCurrentPlayer();
            // Red is reserved for deadly moves, so the red player gets gold.
            const ringByPlayer = { white: 0xffdd44, black: 0x222222, red: 0xffdd44, blue: 0x66aaff };
            const ringColor = isDeadly ? 0xff3333 : (ringByPlayer[currentPlayer] || 0xffdd44);
            
            const indicatorGeo = new THREE.RingGeometry(0.2, 0.35, 24);
            const indicatorMat = new THREE.MeshBasicMaterial({
                color: ringColor,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            const indicator = new THREE.Mesh(indicatorGeo, indicatorMat);
            
            const pos = this.getWorldPosition(move.level, move.row, move.col);
            // Place ring slightly above the cell surface
            const levelHeight = 0.6;
            indicator.position.set(pos.x, pos.y + levelHeight * 0.15, pos.z);
            indicator.rotation.x = -Math.PI / 2;
            
            this.scene.add(indicator);
            this.indicatorMeshes.push(indicator);
        });
    }

    setupRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        let isDragging = false;
        let startX = 0;
        let startY = 0;

        this.container.addEventListener('pointerdown', (e) => {
            isDragging = false;
            startX = e.clientX;
            startY = e.clientY;
        });

        this.container.addEventListener('pointermove', (e) => {
            const dx = Math.abs(e.clientX - startX);
            const dy = Math.abs(e.clientY - startY);
            if (dx > 10 || dy > 10) {
                isDragging = true;
            }
            this.updateHover(e.clientX, e.clientY);
        });

        this.container.addEventListener('pointerleave', () => this.clearHover());

        this.container.addEventListener('pointerup', (e) => {
            if (!isDragging) {
                const data = this.pickTarget(e.clientX, e.clientY);
                if (data) {
                    this.game.onCellClick(data.level, data.row, data.col);
                }
            }
            isDragging = false;
        });
    }

    // Each tier overhangs the ring below it, so from most angles only the
    // outer sliver of a destination field is exposed to the camera, and a
    // click aimed at its middle lands on the tier in front instead. A field
    // the player has been offered therefore wins the ray whatever stands in
    // front of it; everything else resolves to the nearest hit.
    pickTarget(clientX, clientY) {
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        const validMoves = this.game.getValidMoves();

        const dataOf = (intersect) => {
            let obj = intersect.object;
            while (obj) {
                if (obj.userData && obj.userData.level !== undefined) return obj.userData;
                obj = obj.parent;
            }
            return null;
        };

        for (const intersect of intersects) {
            const data = dataOf(intersect);
            if (data && validMoves.some(m => m.level === data.level && m.row === data.row && m.col === data.col)) {
                return data;
            }
        }

        for (const intersect of intersects) {
            const data = dataOf(intersect);
            if (data) {
                const key = `${data.level},${data.row},${data.col}`;
                if (this.stoneMeshes.has(key) || this.cellMeshes.has(key)) return data;
            }
        }

        return null;
    }

    isDeadlyMove(move) {
        return move.type === 'smash' || move.type === 'push-fall' ||
               (move.type === 'push' && move.pushTo && move.pushTo.level < move.level);
    }

    // The sand tiles already render close to white in sunlight, so an added
    // glow barely shows on them; the highlight has to move the material
    // colour itself. Stones are dark, so those take the glow instead.
    tintObject(object, color, emissive) {
        if (!this.hoverRestore) this.hoverRestore = [];
        object.traverse((child) => {
            if (!child.material || !child.material.color) return;
            this.hoverRestore.push({
                material: child.material,
                color: child.material.color.getHex(),
                emissive: child.material.emissive ? child.material.emissive.getHex() : null
            });
            if (color !== null) child.material.color.setHex(color);
            if (emissive !== null && child.material.emissive) child.material.emissive.setHex(emissive);
        });
    }

    clearHover() {
        if (this.hoverRestore) {
            this.hoverRestore.forEach(({ material, color, emissive }) => {
                material.color.setHex(color);
                if (emissive !== null && material.emissive) material.emissive.setHex(emissive);
            });
        }
        this.hoverRestore = null;
        this.hoverKey = null;
    }

    // Hover feedback: a field you may move to lights up, and one where the
    // move would destroy a stone lights up red, so the kill is visible before
    // the click rather than after it.
    updateHover(clientX, clientY) {
        if (!showHints) {
            this.clearHover();
            return;
        }

        const data = this.pickTarget(clientX, clientY);
        const key = data ? `${data.level},${data.row},${data.col}` : null;
        if (key === this.hoverKey) return;

        this.clearHover();
        if (!data) return;

        const move = this.game.getValidMoves().find(m =>
            m.level === data.level && m.row === data.row && m.col === data.col);

        if (move) {
            const deadly = this.isDeadlyMove(move);
            const cellMesh = this.cellMeshes.get(key);
            if (cellMesh) this.tintObject(cellMesh, deadly ? 0xb03a3a : 0xffffff,
                                          deadly ? 0x200808 : 0x242424);
            const stoneMesh = this.stoneMeshes.get(key);
            if (stoneMesh && deadly) this.tintObject(stoneMesh, 0x8f2020, 0x300a0a);
            this.hoverKey = key;
            return;
        }

        // Before a stone is picked up, show which of your own stones can move.
        if (this.game.getSelectedStone()) return;
        const cell = pyramid[data.level] && pyramid[data.level][data.row] &&
                     pyramid[data.level][data.row][data.col];
        if (cell && cell.piece === this.game.getCurrentPlayer()) {
            const stoneMesh = this.stoneMeshes.get(key);
            if (stoneMesh) this.tintObject(stoneMesh, null, 0x3a3a3a);
            this.hoverKey = key;
        }
    }

    setupKeyboard() {
        this.keys = {};
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    animateStone(fromKey, toKey, opts, callback) {
        const mesh = this.stoneMeshes.get(fromKey);
        if (!mesh) {
            if (callback) callback();
            return;
        }

        const style = opts.style || 'move';
        const to = opts.to;

        animatedStones.set(fromKey, { mesh, toKey });

        const startPos = mesh.position.clone();
        const endPos = this.getWorldPosition(to.level, to.row, to.col);

        const duration = style === 'push' ? 500 : 350;
        const lift = style === 'push' ? 0.3 : 0.15;
        const startTime = Date.now();

        const animateStep = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            mesh.position.lerpVectors(startPos, endPos, eased);
            mesh.position.y = startPos.y + (endPos.y - startPos.y) * eased
                + Math.sin(progress * Math.PI) * lift;

            if (progress < 1) {
                requestAnimationFrame(animateStep);
            } else {
                animatedStones.delete(fromKey);
                this.stoneMeshes.delete(fromKey);
                // Never overwrite a key that still holds another mesh - that
                // would strand the old one in the scene as a ghost stone.
                const occupant = this.stoneMeshes.get(toKey);
                if (occupant && occupant !== mesh) this.scene.remove(occupant);
                this.stoneMeshes.set(toKey, mesh);
                mesh.position.copy(endPos);
                if (callback) callback();
            }
        };

        animateStep();
    }

    // A stone that leaves the board (smashed, or pushed off the edge).
    // It is detached from the board map first so nothing can re-key it
    // while its exit animation is still running.
    destroyStone(key, style, dir) {
        const mesh = this.stoneMeshes.get(key);
        if (!mesh) return;
        this.stoneMeshes.delete(key);
        mesh.userData = {}; // a corpse must not answer clicks any more
        this.animateRemoval(mesh, style, dir);
    }

    // Take the meshes of already-captured stones out of the board map so the
    // board state can be applied immediately while they animate out.
    detachStones(stones) {
        const meshes = [];
        stones.forEach(({ level, row, col }) => {
            const key = `${level},${row},${col}`;
            const mesh = this.stoneMeshes.get(key);
            if (mesh) {
                this.stoneMeshes.delete(key);
                mesh.userData = {}; // a corpse must not answer clicks any more
                meshes.push(mesh);
            }
        });
        return meshes;
    }

    animateRemoval(mesh, style, dir) {
        const startPos = mesh.position.clone();
        const duration = 450;
        const startTime = Date.now();

        const step = () => {
            const t = Math.min((Date.now() - startTime) / duration, 1);

            if (style === 'fall') {
                if (dir) {
                    mesh.position.x = startPos.x + dir.dc * t * 1.6;
                    mesh.position.z = startPos.z + dir.dr * t * 1.6;
                }
                mesh.position.y = startPos.y + Math.sin(t * Math.PI) * 0.4 - t * t * 6;
                mesh.rotation.z = t * Math.PI * 1.5;
            } else {
                mesh.position.y = startPos.y - t * 0.45;
                mesh.scale.set(1 + t * 0.35, Math.max(0.001, 1 - t), 1 + t * 0.35);
            }

            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                this.scene.remove(mesh);
            }
        };

        step();
    }

    // Purely visual: the capture has already been applied to the board and
    // these meshes are detached, so nothing here touches game state.
    playOsirisAnimation(stones, attackers, meshes) {
        if (!meshes || meshes.length === 0) return;

        const positions = stones.map(s => this.getWorldPosition(s.level, s.row, s.col));
        const center = new THREE.Vector3();
        positions.forEach(pos => center.add(pos));
        center.divideScalar(positions.length);

        // One laser from each flanking stone into the middle of the line.
        const lasers = attackers.map(a => {
            const points = [this.getWorldPosition(a.level, a.row, a.col), center];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const material = new THREE.LineBasicMaterial({
                color: 0x00aaff,
                transparent: true,
                opacity: 0,
                linewidth: 2
            });
            const laser = new THREE.Line(geometry, material);
            this.scene.add(laser);
            return laser;
        });

        const electricLight = new THREE.PointLight(0x00ffff, 0, 5);
        electricLight.position.copy(center);
        this.scene.add(electricLight);

        const emissives = [];
        meshes.forEach(mesh => {
            mesh.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.emissive = new THREE.Color(0x00ffff);
                    child.material.emissiveIntensity = 0;
                    emissives.push(child.material);
                }
            });
        });

        const phase1Duration = 500; // blue line
        const phase2Duration = 600; // electrify
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;

            if (elapsed < phase1Duration) {
                const progress = elapsed / phase1Duration;
                lasers.forEach(laser => {
                    laser.material.opacity = Math.sin(progress * Math.PI) * 0.9;
                });
                requestAnimationFrame(animate);
            } else if (elapsed < phase1Duration + phase2Duration) {
                const progress = (elapsed - phase1Duration) / phase2Duration;

                lasers.forEach(laser => {
                    laser.material.opacity = 0.9 * (1 - progress);
                });

                electricLight.intensity = Math.sin(progress * Math.PI * 8) * 2 + 2;

                emissives.forEach(material => {
                    material.emissiveIntensity = Math.sin(progress * Math.PI * 6) * 0.6 + 0.6;
                });

                meshes.forEach(mesh => {
                    mesh.scale.setScalar(Math.max(0.001, 1 - progress));
                });

                requestAnimationFrame(animate);
            } else {
                lasers.forEach(laser => {
                    this.scene.remove(laser);
                    laser.geometry.dispose();
                    laser.material.dispose();
                });
                this.scene.remove(electricLight);
                meshes.forEach(mesh => this.scene.remove(mesh));
            }
        };

        animate();
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        if (!this.running) return;
        
        requestAnimationFrame(() => this.animate());

        const rotSpeed = 0.02;
        
        // Handle keyboard camera movement
        if (this.keys['KeyW'] || this.keys['ArrowUp']) {
            if (this.controls) this.controls.rotateUp(rotSpeed);
            else this.camera.position.y += 0.1;
        }
        if (this.keys['KeyS'] || this.keys['ArrowDown']) {
            if (this.controls) this.controls.rotateUp(-rotSpeed);
            else this.camera.position.y -= 0.1;
        }
        if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
            if (this.controls) this.controls.rotateLeft(rotSpeed);
            else this.camera.position.x -= 0.1;
        }
        if (this.keys['KeyD'] || this.keys['ArrowRight']) {
            if (this.controls) this.controls.rotateLeft(-rotSpeed);
            else this.camera.position.x += 0.1;
        }

        if (this.controls) this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// ============================================
// 2D VIEW IMPLEMENTATION
// ============================================

class PyramidView2D {
    constructor(container, gameInterface) {
        this.container = container;
        this.game = gameInterface;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.setupInteraction();
    }

    resize() {
        const rect = this.container.getBoundingClientRect();
        const size = Math.min(rect.width, rect.height) * 0.9;
        this.canvas.width = size;
        this.canvas.height = size;
        this.cellSize = size / 10;
        this.draw();
    }

    getCellPosition(level, row, col) {
        const gridSize = LEVELS[level].size;
        const levelOffset = level * this.cellSize * 0.8;
        const levelCellSize = this.cellSize * 0.85;
        const levelCenterOffset = (LEVELS[0].size - gridSize) / 2;
        
        const x = (levelCenterOffset + col) * levelCellSize + levelOffset + this.cellSize;
        const y = (levelCenterOffset + row) * levelCellSize + levelOffset + this.cellSize;
        
        return { x, y, size: levelCellSize * 0.85 };
    }

    draw() {
        const ctx = this.ctx;
        const size = this.canvas.width;
        
        ctx.fillStyle = '#1a1510';
        ctx.fillRect(0, 0, size, size);

        // Draw pyramid levels
        LEVELS.forEach(({ level, size: gridSize }) => {
            for (let r = 0; r < gridSize; r++) {
                for (let c = 0; c < gridSize; c++) {
                    const pos = this.getCellPosition(level, r, c);
                    const cell = pyramid[level]?.[r]?.[c];
                    
                    if (cell && cell.playable) {
                        // Cell background
                        const brightness = 0.9 - level * 0.15;
                        ctx.fillStyle = `rgb(${Math.floor(232 * brightness)}, ${Math.floor(220 * brightness)}, ${Math.floor(200 * brightness)})`;
                        ctx.fillRect(pos.x, pos.y, pos.size, pos.size);
                        
                        // Victory field indicator
                        if (cell.victory) {
                            ctx.strokeStyle = '#60a5fa';
                            ctx.lineWidth = 2;
                            ctx.beginPath();
                            ctx.arc(pos.x + pos.size/2, pos.y + pos.size/2, pos.size/3, 0, Math.PI * 2);
                            ctx.stroke();
                        }
                        
                        // Stone
                        if (cell.piece) {
                            const stoneSize = pos.size * 0.7;
                            const x = pos.x + (pos.size - stoneSize) / 2;
                            const y = pos.y + (pos.size - stoneSize) / 2;
                            
                            let stoneColor;
                            switch(cell.piece) {
                                case 'white': stoneColor = '#ffffff'; break;
                                case 'black': stoneColor = '#1a1a1a'; break;
                                case 'red': stoneColor = '#cc3333'; break;
                                case 'blue': stoneColor = '#3366cc'; break;
                                default: stoneColor = '#ffffff';
                            }
                            
                            ctx.fillStyle = stoneColor;
                            ctx.beginPath();
                            ctx.arc(x + stoneSize/2, y + stoneSize/2, stoneSize/2, 0, Math.PI * 2);
                            ctx.fill();
                            
                            ctx.strokeStyle = cell.piece === 'white' ? '#999' : (cell.piece === 'red' || cell.piece === 'blue' ? '#ffffff' : '#444');
                            ctx.lineWidth = 1;
                            ctx.stroke();
                        }
                        
                        // Valid move indicator
                        if (selectedStone && validMoves.some(m => m.level === level && m.row === r && m.col === c)) {
                            const move = validMoves.find(m => m.level === level && m.row === r && m.col === c);
                            const isDeadly = move.type === 'smash' || move.type === 'push-fall' || (move.type === 'push' && move.pushTo === null);
                            
                            ctx.fillStyle = isDeadly ? 'rgba(0,0,0,0.8)' : (currentPlayer === 'white' ? 'rgba(255,255,255,0.6)' : 'rgba(68,136,255,0.6)');
                            ctx.beginPath();
                            ctx.arc(pos.x + pos.size/2, pos.y + pos.size/2, pos.size * 0.2, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    }
                }
            }
        });

        // Draw selected stone highlight
        if (selectedStone) {
            const pos = this.getCellPosition(selectedStone.level, selectedStone.row, selectedStone.col);
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3;
            ctx.strokeRect(pos.x - 2, pos.y - 2, pos.size + 4, pos.size + 4);
        }
    }

    setupInteraction() {
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Check which cell was clicked
            for (let level = 0; level < LEVELS.length; level++) {
                for (let r = 0; r < LEVELS[level].size; r++) {
                    for (let c = 0; c < LEVELS[level].size; c++) {
                        const pos = this.getCellPosition(level, r, c);
                        if (x >= pos.x && x <= pos.x + pos.size &&
                            y >= pos.y && y <= pos.y + pos.size) {
                            if (pyramid[level]?.[r]?.[c]?.playable) {
                                this.game.onCellClick(level, r, c);
                                return;
                            }
                        }
                    }
                }
            }
        });
    }
}
