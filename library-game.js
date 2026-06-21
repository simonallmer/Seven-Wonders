/**
 * Library Game Logic Engine
 * Ports the logic from the Dominoverse (Cascading Walls) prototype into a pure state manager.
 */

const BOARD_SIZE = 7;

const PLAYER_COLORS = [
    { id: 0, name: 'Player 1', hex: 0xf8f8f8 }, // White
    { id: 1, name: 'Player 2', hex: 0x2a2a2a }, // Black
    { id: 2, name: 'Player 3', hex: 0xcc3333 }, // Red
    { id: 3, name: 'Player 4', hex: 0x3366cc }  // Blue
];

class LibraryGame {
    constructor() {
        this.boardSize = BOARD_SIZE;
        this.numPlayers = 2;
        this.currentPlayer = 0;
        this.selectedAction = 'LAY'; // LAY, MOVE, PUSH, TOPPLE
        this.selectedWallForAction = null; // {type: 'h'|'v', r, c}
        this.winner = null;
        this.players = [];
        
        // State matrices
        this.fields = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        this.hWalls = Array(BOARD_SIZE - 1).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        this.vWalls = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE - 1).fill(null));

        // Event listeners (for 3D renderer)
        this.listeners = {
            onInit: [],
            onTurnStart: [],
            onActionChanged: [],
            onPlateLaid: [],
            onWallLaid: [],
            onFigureMoved: [],
            onWallMoved: [], // push
            onWallToppled: [], // topple
            onFigureCrushed: [],
            onGameOver: [],
            onMessage: []
        };
    }

    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    }

    trigger(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    log(msg) {
        this.trigger('onMessage', msg);
    }

    initGame(pCount) {
        this.numPlayers = pCount;
        this.winner = null;
        this.currentPlayer = 0;
        this.selectedAction = 'LAY';
        this.selectedWallForAction = null;

        // Reset boards
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                this.fields[r][c] = null;
            }
        }
        for (let r = 0; r < BOARD_SIZE - 1; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                this.hWalls[r][c] = null;
            }
        }
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE - 1; c++) {
                this.vWalls[r][c] = null;
            }
        }

        // Initialize players
        this.players = [];
        for (let i = 0; i < this.numPlayers; i++) {
            let startRow, startCol, goalRow, goalCol, directionDesc;
            
            if (this.numPlayers === 2) {
                if (i === 0) { startRow = BOARD_SIZE - 1; startCol = null; goalRow = 0; goalCol = null; directionDesc = `Reach Top Row`; } 
                else { startRow = 0; startCol = null; goalRow = BOARD_SIZE - 1; goalCol = null; directionDesc = `Reach Bottom Row`; }
            } else {
                if (i === 0) { startRow = BOARD_SIZE - 1; startCol = null; goalRow = 0; goalCol = null; directionDesc = `Reach Top Row`; } 
                else if (i === 1) { startRow = 0; startCol = null; goalRow = BOARD_SIZE - 1; goalCol = null; directionDesc = `Reach Bottom Row`; } 
                else if (i === 2) { startRow = null; startCol = 0; goalRow = null; goalCol = BOARD_SIZE - 1; directionDesc = `Reach Right Column`; } 
                else { startRow = null; startCol = BOARD_SIZE - 1; goalRow = null; goalCol = 0; directionDesc = "Reach Left Column"; }
            }

            this.players.push({
                id: i,
                name: PLAYER_COLORS[i].name,
                colorHex: PLAYER_COLORS[i].hex,
                row: null,
                col: null,
                startRow, startCol, goalRow, goalCol, directionDesc
            });
        }

        // Stone starts in the room — no starting plates, deploy to any edge cell

        this.trigger('onInit', { players: this.players, fields: this.fields });
        this.trigger('onTurnStart', { player: this.players[this.currentPlayer] });
        this.log(`Game started with ${this.numPlayers} players. Lay plates or walls.`);
    }

    setAction(action) {
        if (this.winner) return;
        this.selectedAction = action;
        this.selectedWallForAction = null;
        this.trigger('onActionChanged', action);
    }

    handleCellClick(r, c) {
        if (this.winner) return;
        const cp = this.players[this.currentPlayer];

        if (this.selectedAction === 'LAY') {
            if (this.fields[r][c] !== null) {
                this.log("A plate is already placed here.");
                return;
            }
            this.fields[r][c] = this.currentPlayer;
            this.log(`${cp.name} laid a plate at [${r}, ${c}].`);
            this.trigger('onPlateLaid', { r, c, owner: this.currentPlayer });
            this.endTurn();
        } 
        else if (this.selectedAction === 'MOVE') {
            if (this.isValidMoveTarget(cp, r, c)) {
                cp.row = r;
                cp.col = c;
                this.log(`${cp.name} moved figure to [${r}, ${c}].`);
                this.trigger('onFigureMoved', { player: cp, r, c });
                
                this.checkWinCondition(cp);
                if (!this.winner) {
                    this.endTurn();
                }
            } else {
                this.log("Invalid destination. Choose a connected adjacent Plate.");
            }
        }
    }

    handleWallClick(type, r, c) {
        if (this.winner) return;
        const cp = this.players[this.currentPlayer];

        if (this.selectedAction === 'LAY') {
            if (type === 'h') {
                if (this.hWalls[r][c] !== null) return this.log("A wall already exists here.");

                this.hWalls[r][c] = this.currentPlayer;
                this.log(`${cp.name} laid a horizontal wall.`);
                this.trigger('onWallLaid', { type, r, c, owner: this.currentPlayer });
                this.endTurn();
            } else {
                if (this.vWalls[r][c] !== null) return this.log("A wall already exists here.");

                this.vWalls[r][c] = this.currentPlayer;
                this.log(`${cp.name} laid a vertical wall.`);
                this.trigger('onWallLaid', { type, r, c, owner: this.currentPlayer });
                this.endTurn();
            }
        } 
        else if (this.selectedAction === 'PUSH' || this.selectedAction === 'TOPPLE') {
            const hasWall = (type === 'h' ? this.hWalls[r][c] : this.vWalls[r][c]);
            if (hasWall === null) return this.log("Select an active standing wall.");
            
            this.selectedWallForAction = { type, r, c };
            // Allow UI to prompt for direction
            return this.selectedWallForAction; 
        }
    }

    isValidMoveTarget(player, r, c) {
        if (this.players.find(p => p.row === r && p.col === c)) return false;

        // Deploying from room — must have your own plate on the edge
        if (player.row === null) {
            if (this.fields[r][c] !== player.id) return false;
            if (player.startRow !== null) return r === player.startRow;
            if (player.startCol !== null) return c === player.startCol;
            return false;
        }

        if (this.fields[r][c] === null) return false;

        // BFS through own-color plates to find reachable territory
        const visited = new Set();
        const queue = [[player.row, player.col]];
        visited.add(`${player.row},${player.col}`);

        while (queue.length > 0) {
            const [cr, cc] = queue.shift();
            if (cr === r && cc === c) return true;

            const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
            for (const [dr, dc] of dirs) {
                const nr = cr + dr, nc = cc + dc;
                const key = `${nr},${nc}`;
                if (visited.has(key)) continue;
                if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;

                // Check wall between current and next
                if (dr !== 0) {
                    const minRow = Math.min(cr, nr);
                    if (this.hWalls[minRow][cc] !== null) continue;
                } else {
                    const minCol = Math.min(cc, nc);
                    if (this.vWalls[cr][minCol] !== null) continue;
                }

                const cell = this.fields[nr][nc];
                if (cell === null) continue;

                if (cell === player.id) {
                    // Own plate — can traverse through
                    visited.add(key);
                    queue.push([nr, nc]);
                } else if (cr === player.row && cc === player.col) {
                    // Enemy plate adjacent to player's current cell — one-step reachable
                    if (nr === r && nc === c) return true;
                    visited.add(key); // mark seen so we don't re-check
                } else if (nr === r && nc === c) {
                    // Enemy plate adjacent to a reachable own cell
                    return true;
                }
            }
        }
        return false;
    }

    executePush(direction) {
        if (!this.selectedWallForAction) return;
        const { type, r, c } = this.selectedWallForAction;
        const cp = this.players[this.currentPlayer];
        
        let shiftMap = [];

        if (type === 'h') {
            if (direction === 'left') {
                let targetCol = c;
                while(targetCol >= 0 && this.hWalls[r][targetCol] !== null) { shiftMap.push(targetCol); targetCol--; }
                if (targetCol < 0) return this.log("Push blocked: edge of board.");

                for(let i = shiftMap.length - 1; i >= 0; i--) {
                    let col = shiftMap[i];
                    this.hWalls[r][col - 1] = this.hWalls[r][col];
                    this.hWalls[r][col] = null;
                    this.trigger('onWallMoved', { type: 'h', r, oldC: col, newC: col - 1 });
                }
            } else if (direction === 'right') {
                let targetCol = c;
                while(targetCol < BOARD_SIZE && this.hWalls[r][targetCol] !== null) { shiftMap.push(targetCol); targetCol++; }
                if (targetCol >= BOARD_SIZE) return this.log("Push blocked: edge of board.");

                for(let i = shiftMap.length - 1; i >= 0; i--) {
                    let col = shiftMap[i];
                    this.hWalls[r][col + 1] = this.hWalls[r][col];
                    this.hWalls[r][col] = null;
                    this.trigger('onWallMoved', { type: 'h', r, oldC: col, newC: col + 1 });
                }
            }
        } else if (type === 'v') {
            if (direction === 'up') {
                let targetRow = r;
                while(targetRow >= 0 && this.vWalls[targetRow][c] !== null) { shiftMap.push(targetRow); targetRow--; }
                if (targetRow < 0) return this.log("Push blocked: edge of board.");

                for(let i = shiftMap.length - 1; i >= 0; i--) {
                    let row = shiftMap[i];
                    this.vWalls[row - 1][c] = this.vWalls[row][c];
                    this.vWalls[row][c] = null;
                    this.trigger('onWallMoved', { type: 'v', oldR: row, newR: row - 1, c });
                }
            } else if (direction === 'down') {
                let targetRow = r;
                while(targetRow < BOARD_SIZE && this.vWalls[targetRow][c] !== null) { shiftMap.push(targetRow); targetRow++; }
                if (targetRow >= BOARD_SIZE) return this.log("Push blocked: edge of board.");

                for(let i = shiftMap.length - 1; i >= 0; i--) {
                    let row = shiftMap[i];
                    this.vWalls[row + 1][c] = this.vWalls[row][c];
                    this.vWalls[row][c] = null;
                    this.trigger('onWallMoved', { type: 'v', oldR: row, newR: row + 1, c });
                }
            }
        }

        this.selectedWallForAction = null;
        this.log(`${cp.name} pushed wall ${direction}.`);
        this.endTurn();
    }

    executeTopple(direction) {
        if (!this.selectedWallForAction) return;
        const { type, r, c } = this.selectedWallForAction;
        const cp = this.players[this.currentPlayer];
        
        let toppleChain = [];
        
        if (type === 'h') {
            if (direction === 'up') {
                let currentRow = r;
                while(currentRow >= 0 && this.hWalls[currentRow][c] !== null) {
                    toppleChain.push({r: currentRow, c: c});
                    currentRow--;
                }

                toppleChain.forEach(wall => {
                    this.hWalls[wall.r][wall.c] = null;
                    this.trigger('onWallToppled', { type: 'h', r: wall.r, c: wall.c, dir: direction });
                    if (direction === 'up') this.makePlateAndCrush(wall.r, wall.c);
                    else this.makePlateAndCrush(wall.r + 1, wall.c);
                });
            } else if (direction === 'down') {
                let currentRow = r;
                while(currentRow < BOARD_SIZE - 1 && this.hWalls[currentRow][c] !== null) {
                    toppleChain.push({r: currentRow, c: c});
                    currentRow++;
                }

                toppleChain.forEach(wall => {
                    this.hWalls[wall.r][wall.c] = null;
                    this.trigger('onWallToppled', { type: 'h', r: wall.r, c: wall.c, dir: direction });
                    if (direction === 'up') this.makePlateAndCrush(wall.r, wall.c);
                    else this.makePlateAndCrush(wall.r + 1, wall.c);
                });
            }
        } else if (type === 'v') {
            if (direction === 'left') {
                let currentCol = c;
                while(currentCol >= 0 && this.vWalls[r][currentCol] !== null) {
                    toppleChain.push({r: r, c: currentCol});
                    currentCol--;
                }

                toppleChain.forEach(wall => {
                    this.vWalls[wall.r][wall.c] = null;
                    this.trigger('onWallToppled', { type: 'v', r: wall.r, c: wall.c, dir: direction });
                    if (direction === 'left') this.makePlateAndCrush(wall.r, wall.c);
                    else this.makePlateAndCrush(wall.r, wall.c + 1);
                });
            } else if (direction === 'right') {
                let currentCol = c;
                while(currentCol < BOARD_SIZE - 1 && this.vWalls[r][currentCol] !== null) {
                    toppleChain.push({r: r, c: currentCol});
                    currentCol++;
                }

                toppleChain.forEach(wall => {
                    this.vWalls[wall.r][wall.c] = null;
                    this.trigger('onWallToppled', { type: 'v', r: wall.r, c: wall.c, dir: direction });
                    if (direction === 'left') this.makePlateAndCrush(wall.r, wall.c);
                    else this.makePlateAndCrush(wall.r, wall.c + 1);
                });
            }
        }

        this.selectedWallForAction = null;
        this.log(`${cp.name} toppled wall ${direction}.`);
        this.endTurn();
    }

    makePlateAndCrush(r, c) {
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;
        
        // Remove enemy plate if present
        if (this.fields[r][c] !== null && this.fields[r][c] !== this.currentPlayer) {
            this.trigger('onPlateRemoved', { r, c });
        }
        
        this.fields[r][c] = this.currentPlayer;
        this.trigger('onPlateLaid', { r, c, owner: this.currentPlayer });
        
        // Crush check
        this.players.forEach(p => {
            if (p.row === r && p.col === c) {
                p.row = null;
                p.col = null;
                this.log(`${p.name}'s figure was crushed!`);
                this.trigger('onFigureCrushed', { player: p, r, c });
            }
        });
    }

    endTurn() {
        this.currentPlayer = (this.currentPlayer + 1) % this.numPlayers;
        if (this.selectedAction !== 'MOVE') {
            this.setAction('LAY');
        }
        this.trigger('onTurnStart', { player: this.players[this.currentPlayer] });
    }

    checkWinCondition(player) {
        if (player.goalRow !== null && player.row === player.goalRow) {
            this.winner = player;
        } else if (player.goalCol !== null && player.col === player.goalCol) {
            this.winner = player;
        }

        if (this.winner) {
            this.log(`Game Over! ${this.winner.name} reached the goal!`);
            this.trigger('onGameOver', { winner: this.winner });
        }
    }
}

// Export for 3D file to use
window.libraryGameInstance = new LibraryGame();
