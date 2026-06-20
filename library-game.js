const BOARD_SIZE = 7;

const PLAYER_COLORS = [
    { id: 0, name: 'Player 1', hex: 0x06b6d4 },
    { id: 1, name: 'Player 2', hex: 0xf43f5e },
    { id: 2, name: 'Player 3', hex: 0xf59e0b },
    { id: 3, name: 'Player 4', hex: 0xa855f7 }
];

class LibraryGame {
    constructor() {
        this.boardSize = BOARD_SIZE;
        this.numPlayers = 2;
        this.currentPlayer = 0;
        this.winner = null;
        this.players = [];

        this.fields = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(false));
        this.hWalls = Array(BOARD_SIZE - 1).fill(null).map(() => Array(BOARD_SIZE).fill(false));
        this.vWalls = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE - 1).fill(false));

        this.listeners = {
            onInit: [],
            onTurnStart: [],
            onPlateLaid: [],
            onWallLaid: [],
            onFigureMoved: [],
            onWallMoved: [],
            onWallToppled: [],
            onFigureCrushed: [],
            onGameOver: [],
            onMessage: []
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

    initGame(pCount) {
        this.numPlayers = pCount;
        this.winner = null;
        this.currentPlayer = 0;

        for (let r = 0; r < BOARD_SIZE; r++)
            for (let c = 0; c < BOARD_SIZE; c++)
                this.fields[r][c] = false;

        for (let r = 0; r < BOARD_SIZE - 1; r++)
            for (let c = 0; c < BOARD_SIZE; c++)
                this.hWalls[r][c] = false;

        for (let r = 0; r < BOARD_SIZE; r++)
            for (let c = 0; c < BOARD_SIZE - 1; c++)
                this.vWalls[r][c] = false;

        this.players = [];
        for (let i = 0; i < this.numPlayers; i++) {
            let startRow, startCol, goalRow, goalCol, directionDesc;

            if (this.numPlayers === 2) {
                if (i === 0) { startRow = BOARD_SIZE - 1; startCol = null; goalRow = 0; goalCol = null; directionDesc = 'Reach Top Row'; }
                else { startRow = 0; startCol = null; goalRow = BOARD_SIZE - 1; goalCol = null; directionDesc = 'Reach Bottom Row'; }
            } else {
                if (i === 0) { startRow = BOARD_SIZE - 1; startCol = null; goalRow = 0; goalCol = null; directionDesc = 'Reach Top Row'; }
                else if (i === 1) { startRow = 0; startCol = null; goalRow = BOARD_SIZE - 1; goalCol = null; directionDesc = 'Reach Bottom Row'; }
                else if (i === 2) { startRow = null; startCol = 0; goalRow = null; goalCol = BOARD_SIZE - 1; directionDesc = 'Reach Right Column'; }
                else { startRow = null; startCol = BOARD_SIZE - 1; goalRow = null; goalCol = 0; directionDesc = 'Reach Left Column'; }
            }

            this.players.push({
                id: i,
                name: PLAYER_COLORS[i].name,
                colorHex: PLAYER_COLORS[i].hex,
                row: null, col: null,
                startRow, startCol, goalRow, goalCol, directionDesc
            });
        }

        const mid = Math.floor(BOARD_SIZE / 2);
        for (let i = 0; i < this.numPlayers; i++) {
            const p = this.players[i];
            if (p.startRow !== null) {
                this.fields[p.startRow][mid] = true;
                p.row = p.startRow;
                p.col = mid;
            } else if (p.startCol !== null) {
                this.fields[mid][p.startCol] = true;
                p.row = mid;
                p.col = p.startCol;
            }
        }

        this.trigger('onInit', { players: this.players, fields: this.fields });
        this.trigger('onTurnStart', { player: this.players[this.currentPlayer] });
    }

    handleCellClick(r, c) {
        if (this.winner) return;
        const cp = this.players[this.currentPlayer];

        if (cp.row === r && cp.col === c) return;

        if (this.fields[r][c] && this.isValidMoveTarget(cp, r, c)) {
            const oldR = cp.row, oldC = cp.col;
            cp.row = r;
            cp.col = c;
            this.trigger('onFigureMoved', { player: cp, r, c, oldR, oldC });
            this.checkWinCondition(cp);
            if (!this.winner) this.endTurn();
            return;
        }

        if (!this.fields[r][c]) {
            this.fields[r][c] = true;
            this.trigger('onPlateLaid', { r, c });
            this.endTurn();
            return;
        }

        this.log('Invalid action.');
    }

    handleWallClick(type, r, c, offsetX, offsetZ) {
        if (this.winner) return;
        const cp = this.players[this.currentPlayer];

        if (type === 'h') {
            if (!this.hWalls[r][c]) {
                this.hWalls[r][c] = true;
                this.trigger('onWallLaid', { type, r, c });
                this.endTurn();
                return;
            }
            this.selectedWall = { type, r, c };
            if (Math.abs(offsetX) > Math.abs(offsetZ)) {
                const dir = offsetX < 0 ? 'left' : 'right';
                this.executePush(dir);
            } else {
                const dir = offsetZ < 0 ? 'up' : 'down';
                this.executeTopple(dir);
            }
        } else {
            if (!this.vWalls[r][c]) {
                this.vWalls[r][c] = true;
                this.trigger('onWallLaid', { type, r, c });
                this.endTurn();
                return;
            }
            this.selectedWall = { type, r, c };
            if (Math.abs(offsetZ) > Math.abs(offsetX)) {
                const dir = offsetZ < 0 ? 'up' : 'down';
                this.executePush(dir);
            } else {
                const dir = offsetX < 0 ? 'left' : 'right';
                this.executeTopple(dir);
            }
        }
    }

    isValidMoveTarget(player, r, c) {
        if (!this.fields[r][c]) return false;
        if (this.players.find(p => p.row === r && p.col === c)) return false;

        if (player.row === null) {
            const mid = Math.floor(BOARD_SIZE / 2);
            if (player.startRow !== null) return r === player.startRow && c === mid;
            if (player.startCol !== null) return c === player.startCol && r === mid;
            return false;
        }

        const rDiff = Math.abs(player.row - r);
        const cDiff = Math.abs(player.col - c);

        if ((rDiff === 1 && cDiff === 0) || (rDiff === 0 && cDiff === 1)) {
            if (player.row === r) {
                const minCol = Math.min(player.col, c);
                return !this.vWalls[r][minCol];
            } else {
                const minRow = Math.min(player.row, r);
                return !this.hWalls[minRow][c];
            }
        }
        return false;
    }

    executePush(direction) {
        if (!this.selectedWall) return;
        const { type, r, c } = this.selectedWall;
        const cp = this.players[this.currentPlayer];
        let shiftMap = [];

        if (type === 'h') {
            if (direction === 'left') {
                let targetCol = c;
                while (targetCol >= 0 && this.hWalls[r][targetCol]) { shiftMap.push(targetCol); targetCol--; }
                if (targetCol < 0) return this.log('Push blocked: edge of board.');
                for (let i = shiftMap.length - 1; i >= 0; i--) {
                    let col = shiftMap[i];
                    this.hWalls[r][col] = false;
                    this.hWalls[r][col - 1] = true;
                    this.trigger('onWallMoved', { type: 'h', r, oldC: col, newC: col - 1 });
                }
            } else if (direction === 'right') {
                let targetCol = c;
                while (targetCol < BOARD_SIZE && this.hWalls[r][targetCol]) { shiftMap.push(targetCol); targetCol++; }
                if (targetCol >= BOARD_SIZE) return this.log('Push blocked: edge of board.');
                for (let i = shiftMap.length - 1; i >= 0; i--) {
                    let col = shiftMap[i];
                    this.hWalls[r][col] = false;
                    this.hWalls[r][col + 1] = true;
                    this.trigger('onWallMoved', { type: 'h', r, oldC: col, newC: col + 1 });
                }
            }
        } else if (type === 'v') {
            if (direction === 'up') {
                let targetRow = r;
                while (targetRow >= 0 && this.vWalls[targetRow][c]) { shiftMap.push(targetRow); targetRow--; }
                if (targetRow < 0) return this.log('Push blocked: edge of board.');
                for (let i = shiftMap.length - 1; i >= 0; i--) {
                    let row = shiftMap[i];
                    this.vWalls[row][c] = false;
                    this.vWalls[row - 1][c] = true;
                    this.trigger('onWallMoved', { type: 'v', oldR: row, newR: row - 1, c });
                }
            } else if (direction === 'down') {
                let targetRow = r;
                while (targetRow < BOARD_SIZE && this.vWalls[targetRow][c]) { shiftMap.push(targetRow); targetRow++; }
                if (targetRow >= BOARD_SIZE) return this.log('Push blocked: edge of board.');
                for (let i = shiftMap.length - 1; i >= 0; i--) {
                    let row = shiftMap[i];
                    this.vWalls[row][c] = false;
                    this.vWalls[row + 1][c] = true;
                    this.trigger('onWallMoved', { type: 'v', oldR: row, newR: row + 1, c });
                }
            }
        }

        this.selectedWall = null;
        this.endTurn();
    }

    executeTopple(direction) {
        if (!this.selectedWall) return;
        const { type, r, c } = this.selectedWall;
        const cp = this.players[this.currentPlayer];
        let toppleChain = [];

        if (type === 'h') {
            if (direction === 'up') {
                let currentRow = r;
                while (currentRow >= 0 && this.hWalls[currentRow][c]) {
                    toppleChain.push({ r: currentRow, c: c });
                    currentRow--;
                }
                toppleChain.forEach(wall => {
                    this.hWalls[wall.r][wall.c] = false;
                    this.trigger('onWallToppled', { type: 'h', r: wall.r, c: wall.c, dir: direction });
                    this.makePlateAndCrush(wall.r, wall.c);
                });
            } else if (direction === 'down') {
                let currentRow = r;
                while (currentRow < BOARD_SIZE - 1 && this.hWalls[currentRow][c]) {
                    toppleChain.push({ r: currentRow, c: c });
                    currentRow++;
                }
                toppleChain.forEach(wall => {
                    this.hWalls[wall.r][wall.c] = false;
                    this.trigger('onWallToppled', { type: 'h', r: wall.r, c: wall.c, dir: direction });
                    this.makePlateAndCrush(wall.r + 1, wall.c);
                });
            }
        } else if (type === 'v') {
            if (direction === 'left') {
                let currentCol = c;
                while (currentCol >= 0 && this.vWalls[r][currentCol]) {
                    toppleChain.push({ r: r, c: currentCol });
                    currentCol--;
                }
                toppleChain.forEach(wall => {
                    this.vWalls[wall.r][wall.c] = false;
                    this.trigger('onWallToppled', { type: 'v', r: wall.r, c: wall.c, dir: direction });
                    this.makePlateAndCrush(wall.r, wall.c);
                });
            } else if (direction === 'right') {
                let currentCol = c;
                while (currentCol < BOARD_SIZE - 1 && this.vWalls[r][currentCol]) {
                    toppleChain.push({ r: r, c: currentCol });
                    currentCol++;
                }
                toppleChain.forEach(wall => {
                    this.vWalls[wall.r][wall.c] = false;
                    this.trigger('onWallToppled', { type: 'v', r: wall.r, c: wall.c, dir: direction });
                    this.makePlateAndCrush(wall.r, wall.c + 1);
                });
            }
        }

        this.selectedWall = null;
        this.endTurn();
    }

    makePlateAndCrush(r, c) {
        if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return;

        if (!this.fields[r][c]) {
            this.fields[r][c] = true;
            this.trigger('onPlateLaid', { r, c });
        }

        this.players.forEach(p => {
            if (p.row === r && p.col === c) {
                p.row = null;
                p.col = null;
                this.trigger('onFigureCrushed', { player: p, r, c });
            }
        });
    }

    endTurn() {
        this.currentPlayer = (this.currentPlayer + 1) % this.numPlayers;
        this.trigger('onTurnStart', { player: this.players[this.currentPlayer] });
    }

    checkWinCondition(player) {
        if (player.goalRow !== null && player.row === player.goalRow) {
            this.winner = player;
        } else if (player.goalCol !== null && player.col === player.goalCol) {
            this.winner = player;
        }

        if (this.winner) {
            this.trigger('onGameOver', { winner: this.winner });
        }
    }
}

window.libraryGameInstance = new LibraryGame();
