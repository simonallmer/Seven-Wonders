/**
 * Library Game Logic Engine
 * Shared sphere mode: one sphere starts at the central fountain. Place plates to
 * extend paths, then push the sphere toward your study room entrance to win.
 */

const BOARD_SIZE = 7;

const PLAYER_COLORS = [
    { id: 0, name: 'Player 1', hex: 0xf8f8f8 },
    { id: 1, name: 'Player 2', hex: 0x2a2a2a },
    { id: 2, name: 'Player 3', hex: 0xcc3333 },
    { id: 3, name: 'Player 4', hex: 0x3366cc }
];

const HOME_CELLS = [
    { r: BOARD_SIZE - 1, c: Math.floor(BOARD_SIZE / 2) },
    { r: 0, c: Math.floor(BOARD_SIZE / 2) },
    { r: Math.floor(BOARD_SIZE / 2), c: BOARD_SIZE - 1 },
    { r: Math.floor(BOARD_SIZE / 2), c: 0 }
];

const CENTER = Math.floor(BOARD_SIZE / 2);
const FOUNTAIN = -1;

class LibraryGame {
    constructor() {
        this.boardSize = BOARD_SIZE;
        this.numPlayers = 2;
        this.currentPlayer = 0;
        this.winner = null;
        this.players = [];

        this.sharedSphere = { r: CENTER, c: CENTER };
        this._prevSpherePos = { r: CENTER, c: CENTER };
        this._lastPushTurn = -1;

        // "Open Ends" variant: the sphere only stops at walls. Rolling past the
        // end of a plate road (or over the board edge) makes it fall and respawn
        // at the fountain. The player's own entrance still catches it mid-roll.
        this.openEnds = false;

        this.interactionState = 'IDLE'; // IDLE | WALL_SELECTED | SPHERE_SELECTED
        this.selectedWall = null;

        this.controlScheme = 'adaptive'; // 'adaptive' | 'classic'
        this.selectedAction = 'LAY'; // LAY | MOVE | PUSH | TOPPLE | PUSH_SPHERE (classic only)

        this.fields = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        this.hWalls = Array(BOARD_SIZE - 1).fill(null).map(() => Array(BOARD_SIZE).fill(null));
        this.vWalls = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE - 1).fill(null));

        this.listeners = {
            onInit: [],
            onTurnStart: [],
            onWallSelected: [],
            onWallDeselected: [],
            onPlateLaid: [],
            onWallLaid: [],
            onWallMoved: [],
            onWallToppled: [],
            onPlateRemoved: [],
            onGameOver: [],
            onSphereMoved: [],
            onSphereFell: [],
            onSphereSelected: [],
            onSphereDeselected: [],
            onVariantChanged: [],
            onMessage: [],
            onControlSchemeChanged: [],
            onActionChanged: []
        };
    }

    on(event, callback) {
        if (this.listeners[event]) this.listeners[event].push(callback);
    }

    trigger(event, data) {
        if (this.listeners[event]) this.listeners[event].forEach(cb => cb(data));
    }

    log(msg) {
        this.trigger('onMessage', msg);
    }

    setControlScheme(scheme) {
        if (scheme !== 'adaptive' && scheme !== 'classic') return;
        this.controlScheme = scheme;
        this.interactionState = 'IDLE';
        this.selectedWall = null;
        this.trigger('onControlSchemeChanged', scheme);
    }

    setAction(action) {
        if (!['LAY', 'MOVE', 'PUSH', 'TOPPLE', 'PUSH_SPHERE'].includes(action)) return;
        this.selectedAction = action;
        this.interactionState = 'IDLE';
        this.selectedWall = null;
        this.trigger('onActionChanged', action);
    }

    setOpenEnds(enabled) {
        this.openEnds = !!enabled;
        this.trigger('onVariantChanged', this.openEnds);
    }

    initGame(pCount) {
        this.numPlayers = pCount;
        this.winner = null;
        this.currentPlayer = 0;
        this.interactionState = 'IDLE';
        this.selectedWall = null;
        this.sharedSphere = { r: CENTER, c: CENTER };
        this._prevSpherePos = { r: CENTER, c: CENTER };
        this._lastPushTurn = -1;

        for (let r = 0; r < BOARD_SIZE; r++)
            for (let c = 0; c < BOARD_SIZE; c++)
                this.fields[r][c] = null;

        this.fields[CENTER][CENTER] = FOUNTAIN;

        for (let r = 0; r < BOARD_SIZE - 1; r++)
            for (let c = 0; c < BOARD_SIZE; c++)
                this.hWalls[r][c] = null;

        for (let r = 0; r < BOARD_SIZE; r++)
            for (let c = 0; c < BOARD_SIZE - 1; c++)
                this.vWalls[r][c] = null;

        this.players = [];
        for (let i = 0; i < this.numPlayers; i++) {
            this.players.push({
                id: i,
                name: PLAYER_COLORS[i].name,
                colorHex: PLAYER_COLORS[i].hex,
                entrance: HOME_CELLS[i],
                directionDesc: `Guide the sphere to your entrance (row ${HOME_CELLS[i].r}, col ${HOME_CELLS[i].c})`
            });
        }

        this.trigger('onInit', { players: this.players, fields: this.fields });
        this.trigger('onTurnStart', { player: this.players[this.currentPlayer] });
        this.log(`Game started — Shared Sphere mode, ${this.numPlayers} players.`);
    }

    // ============================================
    // CONTEXT-SENSITIVE ENTRY POINTS
    // ============================================

    handleCellClick(r, c) {
        if (this.winner) return;
        if (this.controlScheme === 'classic') return;

        if (this.interactionState === 'SPHERE_SELECTED') {
            const dr = r - this.sharedSphere.r;
            const dc = c - this.sharedSphere.c;
            if ((dr === 0 && Math.abs(dc) === 1) || (dc === 0 && Math.abs(dr) === 1)) {
                this.doPushSphere(Math.sign(dr), Math.sign(dc));
            } else if (r === this.sharedSphere.r && c === this.sharedSphere.c) {
                this.interactionState = 'IDLE';
                this.trigger('onSphereDeselected', {});
            } else {
                this.log('Click a cell adjacent to the sphere to push it, or click the sphere to deselect.');
                this.interactionState = 'IDLE';
                this.trigger('onSphereDeselected', {});
            }
            return;
        }

        if (this.interactionState !== 'IDLE') return;

        if (this.interactionState === 'IDLE') {
            const field = this.fields[r][c];

            if (field === null) {
                this.doPlace(r, c);
                return;
            }

            if (r === this.sharedSphere.r && c === this.sharedSphere.c) {
                this.interactionState = 'SPHERE_SELECTED';
                this.trigger('onSphereSelected', {});
                this.log('Sphere selected. Click a lit tile to roll it there.');
                return;
            }

            this.log('That cell is already occupied.');
        }
    }

    handleWallClick(type, r, c) {
        if (this.winner) return;
        if (this.controlScheme === 'classic') return;
        if (this.interactionState !== 'IDLE') return;
        const cp = this.players[this.currentPlayer];
        const wall = (type === 'h') ? this.hWalls[r][c] : this.vWalls[r][c];

        if (wall === null) {
            this.doLayWall(type, r, c);
            return;
        }

        if (wall === this.currentPlayer) {
            this.interactionState = 'WALL_SELECTED';
            this.selectedWall = { type, r, c };
            this.trigger('onWallSelected', { type, r, c, player: cp });
            this.log(`${cp.name} selected a wall. Click a direction to push or topple.`);
            return;
        }

        this.log("That's not your wall.");
    }

    handleWallDirection(direction) {
        if (!this.selectedWall) return;
        const { type, r, c } = this.selectedWall;
        this.selectedWall = null;
        this.interactionState = 'IDLE';
        this.trigger('onWallDeselected', {});

        if (type === 'h') {
            if (direction === 'left' || direction === 'right') {
                this.doPushWall('h', r, c, direction);
            } else {
                this.doToppleWall('h', r, c, direction);
            }
        } else {
            if (direction === 'up' || direction === 'down') {
                this.doPushWall('v', r, c, direction);
            } else {
                this.doToppleWall('v', r, c, direction);
            }
        }
    }

    // ============================================
    // INTERNAL ACTIONS
    // ============================================

    doPlace(r, c) {
        const cp = this.players[this.currentPlayer];
        this.fields[r][c] = this.currentPlayer;
        this.log(`${cp.name} laid a plate at [${r}, ${c}].`);
        this.trigger('onPlateLaid', { r, c, owner: this.currentPlayer });
        this.endTurn();
    }

    // Traces where a push would take the sphere without moving it.
    // In the Open Ends variant the sphere only stops at walls: an open end
    // (board edge or unplated cell ahead) means it falls, and the current
    // player's own entrance catches it mid-roll like a doorway.
    simulateSphereRoll(dirR, dirC) {
        let r = this.sharedSphere.r;
        let c = this.sharedSphere.c;
        const entrance = this.players[this.currentPlayer].entrance;
        let fell = false;

        while (true) {
            const nr = r + dirR, nc = c + dirC;
            const offBoard = nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE;
            if (!offBoard) {
                if (dirR !== 0) {
                    if (this.hWalls[Math.min(r, nr)][c] !== null) break;
                } else {
                    if (this.vWalls[r][Math.min(c, nc)] !== null) break;
                }
            }
            if (offBoard || this.fields[nr][nc] === null) {
                if (this.openEnds && (r !== this.sharedSphere.r || c !== this.sharedSphere.c)) fell = true;
                break;
            }
            r = nr;
            c = nc;
            if (this.openEnds && r === entrance.r && c === entrance.c) break;
        }

        return { r, c, fell };
    }

    doPushSphere(dirR, dirC) {
        if (dirR === 0 && dirC === 0) return;

        let { r, c, fell } = this.simulateSphereRoll(dirR, dirC);

        if (!fell && r === this.sharedSphere.r && c === this.sharedSphere.c) {
            this.log('The sphere cannot move in that direction.');
            this.trigger('onSphereDeselected', {});
            return;
        }

        if (fell) {
            const cp = this.players[this.currentPlayer];
            this._prevSpherePos = { r: CENTER, c: CENTER };
            this._lastPushTurn = -1;
            this.sharedSphere.r = CENTER;
            this.sharedSphere.c = CENTER;
            this.trigger('onSphereFell', { fromR: r, fromC: c, dirR, dirC });
            this.trigger('onSphereDeselected', {});
            this.log(`${cp.name} pushed the sphere over an open end! It returns to the fountain.`);
            this.endTurn();
            return;
        }

        if (this._lastPushTurn >= 0) {
            const nextPlayer = (this._lastPushTurn + 1) % this.numPlayers;
            if (this.currentPlayer === nextPlayer) {
                if (r === this._prevSpherePos.r && c === this._prevSpherePos.c) {
                    this.log('Cannot push the sphere back to where it was last turn.');
                    this.trigger('onSphereDeselected', {});
                    return;
                }
            }
        }

        const oldR = this.sharedSphere.r;
        const oldC = this.sharedSphere.c;
        this._prevSpherePos = { r: oldR, c: oldC };
        this._lastPushTurn = this.currentPlayer;

        this.sharedSphere.r = r;
        this.sharedSphere.c = c;
        this.trigger('onSphereMoved', { r, c });
        this.trigger('onSphereDeselected', {});
        this.log(`${this.players[this.currentPlayer].name} pushed the sphere to [${r}, ${c}].`);

        const entrance = this.players[this.currentPlayer].entrance;
        if (r === entrance.r && c === entrance.c) {
            this.winner = this.players[this.currentPlayer];
            this.trigger('onGameOver', { winner: this.winner });
        } else {
            this.endTurn();
        }
    }

    doLayWall(type, r, c) {
        const cp = this.players[this.currentPlayer];
        if (type === 'h') {
            this.hWalls[r][c] = this.currentPlayer;
        } else {
            this.vWalls[r][c] = this.currentPlayer;
        }
        this.log(`${cp.name} laid a ${type === 'h' ? 'horizontal' : 'vertical'} wall.`);
        this.trigger('onWallLaid', { type, r, c, owner: this.currentPlayer });
        this.endTurn();
    }

    doPushWall(type, r, c, direction) {
        const cp = this.players[this.currentPlayer];
        let shiftMap = [];

        if (type === 'h') {
            if (direction === 'left') {
                let targetCol = c;
                while (targetCol >= 0 && this.hWalls[r][targetCol] !== null) { shiftMap.push(targetCol); targetCol--; }
                if (targetCol < 0) { this.log('Push blocked: edge of board.'); return; }
                for (let i = shiftMap.length - 1; i >= 0; i--) {
                    let col = shiftMap[i];
                    this.hWalls[r][col - 1] = this.hWalls[r][col];
                    this.hWalls[r][col] = null;
                    this.trigger('onWallMoved', { type: 'h', r, oldC: col, newC: col - 1 });
                }
            } else {
                let targetCol = c;
                while (targetCol < BOARD_SIZE && this.hWalls[r][targetCol] !== null) { shiftMap.push(targetCol); targetCol++; }
                if (targetCol >= BOARD_SIZE) { this.log('Push blocked: edge of board.'); return; }
                for (let i = shiftMap.length - 1; i >= 0; i--) {
                    let col = shiftMap[i];
                    this.hWalls[r][col + 1] = this.hWalls[r][col];
                    this.hWalls[r][col] = null;
                    this.trigger('onWallMoved', { type: 'h', r, oldC: col, newC: col + 1 });
                }
            }
        } else {
            if (direction === 'up') {
                let targetRow = r;
                while (targetRow >= 0 && this.vWalls[targetRow][c] !== null) { shiftMap.push(targetRow); targetRow--; }
                if (targetRow < 0) { this.log('Push blocked: edge of board.'); return; }
                for (let i = shiftMap.length - 1; i >= 0; i--) {
                    let row = shiftMap[i];
                    this.vWalls[row - 1][c] = this.vWalls[row][c];
                    this.vWalls[row][c] = null;
                    this.trigger('onWallMoved', { type: 'v', oldR: row, newR: row - 1, c });
                }
            } else {
                let targetRow = r;
                while (targetRow < BOARD_SIZE && this.vWalls[targetRow][c] !== null) { shiftMap.push(targetRow); targetRow++; }
                if (targetRow >= BOARD_SIZE) { this.log('Push blocked: edge of board.'); return; }
                for (let i = shiftMap.length - 1; i >= 0; i--) {
                    let row = shiftMap[i];
                    this.vWalls[row + 1][c] = this.vWalls[row][c];
                    this.vWalls[row][c] = null;
                    this.trigger('onWallMoved', { type: 'v', oldR: row, newR: row + 1, c });
                }
            }
        }

        this.log(`${cp.name} pushed wall ${direction}.`);
        this.endTurn();
    }

    doToppleWall(type, r, c, direction) {
        const cp = this.players[this.currentPlayer];
        let toppleChain = [];

        if (type === 'h') {
            if (direction === 'up') {
                let currentRow = r;
                while (currentRow >= 0 && this.hWalls[currentRow][c] !== null) {
                    toppleChain.push({ r: currentRow, c });
                    currentRow--;
                }
                toppleChain.forEach(wall => {
                    this.hWalls[wall.r][wall.c] = null;
                    this.trigger('onWallToppled', { type: 'h', r: wall.r, c: wall.c, dir: direction });
                    this.makePlateAndCrush(wall.r, wall.c);
                });
            } else {
                let currentRow = r;
                while (currentRow < BOARD_SIZE - 1 && this.hWalls[currentRow][c] !== null) {
                    toppleChain.push({ r: currentRow, c });
                    currentRow++;
                }
                toppleChain.forEach(wall => {
                    this.hWalls[wall.r][wall.c] = null;
                    this.trigger('onWallToppled', { type: 'h', r: wall.r, c: wall.c, dir: direction });
                    this.makePlateAndCrush(wall.r + 1, wall.c);
                });
            }
        } else {
            if (direction === 'left') {
                let currentCol = c;
                while (currentCol >= 0 && this.vWalls[r][currentCol] !== null) {
                    toppleChain.push({ r, c: currentCol });
                    currentCol--;
                }
                toppleChain.forEach(wall => {
                    this.vWalls[wall.r][wall.c] = null;
                    this.trigger('onWallToppled', { type: 'v', r: wall.r, c: wall.c, dir: direction });
                    this.makePlateAndCrush(wall.r, wall.c);
                });
            } else {
                let currentCol = c;
                while (currentCol < BOARD_SIZE - 1 && this.vWalls[r][currentCol] !== null) {
                    toppleChain.push({ r, c: currentCol });
                    currentCol++;
                }
                toppleChain.forEach(wall => {
                    this.vWalls[wall.r][wall.c] = null;
                    this.trigger('onWallToppled', { type: 'v', r: wall.r, c: wall.c, dir: direction });
                    this.makePlateAndCrush(wall.r, wall.c + 1);
                });
            }
        }

        this.log(`${cp.name} toppled wall ${direction}.`);
        this.endTurn();
    }

    // ============================================
    // CRUSH & WIN
    // ============================================

    makePlateAndCrush(r, c) {
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;
        if (this.fields[r][c] !== null && this.fields[r][c] !== this.currentPlayer) {
            this.trigger('onPlateRemoved', { r, c });
        }
        this.fields[r][c] = this.currentPlayer;
        this.trigger('onPlateLaid', { r, c, owner: this.currentPlayer });

        if (this.sharedSphere.r === r && this.sharedSphere.c === c) {
            this.sharedSphere.r = CENTER;
            this.sharedSphere.c = CENTER;
            this.trigger('onSphereMoved', { r: CENTER, c: CENTER });
            this.log('The toppled wall crushed the sphere! It respawns at the fountain.');
        }
    }

    endTurn() {
        this.selectedWall = null;
        this.interactionState = 'IDLE';
        this.trigger('onWallDeselected', {});

        this.currentPlayer = (this.currentPlayer + 1) % this.numPlayers;
        this.trigger('onTurnStart', { player: this.players[this.currentPlayer] });
    }
}

window.libraryGameInstance = new LibraryGame();
