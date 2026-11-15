// CATHEDRAL — pure rules. Game design: Simon Allmer.
// No rendering, no DOM: this module is shared by the game, the AI worker and the tests.
//
// The floor is a cross of five fields of 5 × 5: a square of 15 × 15 with the corners left out. Stones stand
// on the crossings of the lines engraved in it. Lines run along rows and columns everywhere; diagonals pass
// only through the strong crossings (column + row odd), so the very middle is entered on four lines.
// Outside each corner of the crossing a walkway — a passage — joins the flanks of two neighbouring arms.
// 2 players: White in the south arm, Black in the north. 4 players: Red in the west, Blue in the east.
//
// A field of the grid holds 0 or a colour.

export const WHITE = 1, BLACK = 2, RED = 3, BLUE = 4;
export const COLOR_NAMES = ['', 'White', 'Black', 'Red', 'Blue'];
export const SIZE = 15, LO = 5, HI = 9, MIN_STONES = 4, MAX_CHAIN = 8;
// eight directions as [dx, dy]: the four straight ones first
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const PASSAGES = [[[5, 2], [2, 5]], [[9, 2], [12, 5]], [[12, 9], [9, 12]], [[2, 9], [5, 12]]];

export function turnOrder(nPlayers) {
    return nPlayers === 2 ? [WHITE, BLACK] : [WHITE, RED, BLACK, BLUE];
}

const inside = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && ((x >= LO && x <= HI) || (y >= LO && y <= HI));

function makeLayout() {
    const cells = [], at = new Int16Array(SIZE * SIZE).fill(-1);
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (inside(x, y)) { at[y * SIZE + x] = cells.length; cells.push({ x, y, strong: (x + y) % 2 === 1 }); }
    const N = cells.length, find = (x, y) => (inside(x, y) ? at[y * SIZE + x] : -1);
    // step[i * 8 + d]: the crossing joined to i in direction d, or -1 (diagonals leave strong crossings only)
    const step = new Int16Array(N * 8).fill(-1);
    cells.forEach((c, i) => DIRS.forEach(([dx, dy], d) => { if (d < 4 || c.strong) step[i * 8 + d] = find(c.x + dx, c.y + dy); }));
    const passage = new Int16Array(N).fill(-1);
    for (const [[ax, ay], [bx, by]] of PASSAGES) { const a = find(ax, ay), b = find(bx, by); passage[a] = b; passage[b] = a; }
    return { N, cells, find, step, passage };
}
export const L = makeLayout();
export const layout = () => L;

export function createState(nPlayers = 2) {
    const n = nPlayers === 2 ? 2 : 4, grid = new Int8Array(L.N);
    for (let i = LO; i <= HI; i++) for (let d = 0; d < 3; d++) {
        grid[L.find(i, SIZE - 1 - d)] = WHITE; grid[L.find(i, d)] = BLACK;
        if (n === 4) { grid[L.find(d, i)] = RED; grid[L.find(SIZE - 1 - d, i)] = BLUE; }
    }
    return { nPlayers: n, grid, turn: 0, ply: 0, stuck: false };
}
export function cloneState(s) {
    return { nPlayers: s.nPlayers, grid: s.grid.slice(), turn: s.turn, ply: s.ply, stuck: s.stuck };
}
export const currentColor = (s) => turnOrder(s.nPlayers)[s.turn];

export function countStones(s) {
    const n = [0, 0, 0, 0, 0];
    for (const v of s.grid) n[v]++;
    return n;
}

// Procession: a stone may go as far as the longest unbroken line of friendly stones standing directly beside it
// is long — one field at least.
export function reach(g, i) {
    const color = g[i];
    let best = 1;
    for (let d = 0; d < 8; d++) {
        let n = 0, j = L.step[i * 8 + d];
        // a line keeps its direction: follow it by coordinates, not by the lines of the next crossing
        if (j < 0) continue;
        const [dx, dy] = DIRS[d];
        let { x, y } = L.cells[i];
        for (x += dx, y += dy; (j = L.find(x, y)) >= 0 && g[j] === color; x += dx, y += dy) n++;
        if (n > best) best = n;
    }
    return best;
}

// the unbroken line of one rival colour that begins at (x, y) and runs on in direction d
function lineFrom(g, color, x, y, d) {
    let j = L.find(x, y);
    if (j < 0 || !g[j] || g[j] === color) return null;
    const victim = g[j], [dx, dy] = DIRS[d], run = [];
    for (; (j = L.find(x, y)) >= 0 && g[j] === victim; x += dx, y += dy) run.push(j);
    return run;
}

// One step of the stone on `from`.
//   walk     along a line over empty fields, as far as its procession reaches
//   passage  through a doorway to the neighbouring arm: one step, converts nothing
//   convert  a walk that ends directly in front of a rival line in the direction of travel: the line changes colour
// After a conversion the same stone may convert again (visited = the fields it has touched this turn, which it
// may not enter again); it may no longer simply walk.
// step = { type, from, to, dir, run[] }
export function stepsFrom(s, from, visited = null, out = []) {
    const g = s.grid, color = g[from], far = reach(g, from), c = L.cells[from];
    for (let d = 0; d < 8; d++) {
        if (L.step[from * 8 + d] < 0) continue;
        const [dx, dy] = DIRS[d];
        for (let k = 1, x = c.x + dx, y = c.y + dy; k <= far; k++, x += dx, y += dy) {
            const j = L.find(x, y);
            if (j < 0 || g[j] || (visited && visited.has(j))) break;
            const run = lineFrom(g, color, x + dx, y + dy, d);
            if (run) out.push({ type: 'convert', from, to: j, dir: d, run });
            else if (!visited) out.push({ type: 'walk', from, to: j, dir: d, run: null });
        }
    }
    if (!visited) { const j = L.passage[from]; if (j >= 0 && !g[j]) out.push({ type: 'passage', from, to: j, dir: -1, run: null }); }
    return out;
}

function applyStep(g, st) {
    const color = g[st.from];
    g[st.from] = 0; g[st.to] = color;
    if (st.run) for (const i of st.run) g[i] = color;
}

// Every complete move of one stone: move = { from, steps[] }. A chain of conversions may stop after any of them.
export function movesFrom(s, from, out = []) {
    for (const st of stepsFrom(s, from)) {
        out.push({ from, steps: [st] });
        if (st.type !== 'convert') continue;
        const rec = (g, steps, visited) => {
            if (steps.length >= MAX_CHAIN) return;
            const at = steps[steps.length - 1].to;
            for (const nx of stepsFrom({ grid: g }, at, visited)) {
                const next = steps.concat(nx);
                out.push({ from, steps: next });
                const g2 = g.slice(); applyStep(g2, nx);
                rec(g2, next, new Set(visited).add(nx.to));
            }
        };
        const g1 = s.grid.slice(); applyStep(g1, st);
        rec(g1, [st], new Set([from, st.to]));
    }
    return out;
}

export function allMoves(s, color = currentColor(s)) {
    const out = [];
    for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === color) movesFrom(s, i, out);
    return out;
}

function hasMove(s, color) {
    const tmp = [];
    for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === color && stepsFrom(s, i, null, tmp).length) return true;
    return false;
}

// Applies a move in place. Returns the steps that were taken, each with the colour that moved and the colour
// of the line it converted.
export function applyMove(s, m, wantEvents = true) {
    const ev = wantEvents ? [] : null, color = s.grid[m.from];
    for (const st of m.steps) { ev && ev.push({ ...st, color, victim: st.run ? s.grid[st.run[0]] : 0 }); applyStep(s.grid, st); }
    s.ply++;
    // the next congregation that still has its voice (four stones) and a stone that can move
    const n = s.nPlayers, order = turnOrder(n), counts = countStones(s);
    let k = 0;
    do { s.turn = (s.turn + 1) % n; k++; } while (k <= n && (counts[order[s.turn]] < MIN_STONES || !hasMove(s, order[s.turn])));
    s.stuck = k > n;
    return ev;
}

// Returns null while the game runs, else { winner: colour | 0, reason }.
export function outcome(s) {
    const order = turnOrder(s.nPlayers), counts = countStones(s), alive = order.filter((c) => counts[c] >= MIN_STONES);
    if (alive.length === 1) return { winner: alive[0], reason: 'silence' };
    if (alive.length === 0) return { winner: 0, reason: 'silence' };
    if (s.stuck) { // nobody can move: the largest congregation takes the cathedral
        let best = 0, tie = false;
        for (const c of alive) { if (!best || counts[c] > counts[best]) { best = c; tie = false; } else if (counts[c] === counts[best]) tie = true; }
        return { winner: tie ? 0 : best, reason: 'stuck' };
    }
    return null;
}

export function positionKey(s) {
    return s.turn + ':' + Array.prototype.join.call(s.grid, '');
}
