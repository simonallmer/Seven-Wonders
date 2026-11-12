// TEMPLE — pure rules. Game design: Simon Allmer.
// No rendering, no DOM: this module is shared by the game, the AI worker and the tests.
//
// The floor of the temple is a mesh of fields. Every field is joined to its neighbours along the
// rows and columns; fields where row + column is even are also joined diagonally.
// 2 players: a long hexagon of 33 fields with an Artemis field at each tip.
// 4 players: a Greek cross of 61 fields, four arms around a free centre, an Artemis field at each tip.
// Every player starts in the nine fields around their own tip and races to the tip opposite.

export const WHITE = 1, BLACK = 2, RED = 3, BLUE = 4;
export const COLOR_NAMES = ['', 'White', 'Black', 'Red', 'Blue'];
// eight directions, clockwise from "up the board"; neighbours in this list are 45° apart
export const DIRS = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
// the direction each colour advances in; it may also move sideways, never back
const FORWARD = [0, 0, 4, 2, 6]; // white up, black down, red right, blue left

export function turnOrder(nPlayers) {
    return nPlayers === 2 ? [WHITE, BLACK] : [WHITE, RED, BLACK, BLUE];
}

function makeLayout(nPlayers) {
    const rows = nPlayers === 2
        ? [[2, 1], [1, 3], [0, 5], [0, 5], [0, 5], [0, 5], [0, 5], [1, 3], [2, 1]]
        : [[5, 1], [4, 3], [3, 5], [2, 7], [1, 9], [0, 11], [1, 9], [2, 7], [3, 5], [4, 3], [5, 1]];
    const H = rows.length, W = nPlayers === 2 ? 5 : 11, mid = (W - 1) / 2, midRow = (H - 1) / 2;
    const cells = [], at = new Map();
    rows.forEach(([off, n], r) => { for (let c = off; c < off + n; c++) { at.set(r * 16 + c, cells.length); cells.push({ row: r, col: c }); } });
    const N = cells.length;
    // step[i * 8 + d]: the field joined to i in direction d, or -1
    const step = new Int8Array(N * 8).fill(-1);
    cells.forEach(({ row, col }, i) => DIRS.forEach(([dr, dc], d) => {
        if (d % 2 && (row + col) % 2) return; // diagonals leave even fields only
        const j = at.get((row + dr) * 16 + col + dc);
        if (j !== undefined && row + dr >= 0 && col + dc >= 0) step[i * 8 + d] = j;
    }));
    const tip = { [WHITE]: at.get((H - 1) * 16 + mid), [BLACK]: at.get(mid) };
    if (nPlayers === 4) { tip[RED] = at.get(midRow * 16); tip[BLUE] = at.get(midRow * 16 + W - 1); }
    const target = { [WHITE]: tip[BLACK], [BLACK]: tip[WHITE], [RED]: tip[BLUE], [BLUE]: tip[RED] };
    // the nine starting fields: the three lines nearest the player's own tip
    const start = new Int8Array(N);
    cells.forEach(({ row, col }, i) => {
        if (row <= 2) start[i] = BLACK;
        else if (row >= H - 3) start[i] = WHITE;
        else if (nPlayers === 4 && col <= 2) start[i] = RED;
        else if (nPlayers === 4 && col >= W - 3) start[i] = BLUE;
    });
    // how far a field lies along each colour's way, 0 at its own tip
    const progress = [null, cells.map((c) => H - 1 - c.row), cells.map((c) => c.row), cells.map((c) => c.col), cells.map((c) => W - 1 - c.col)];
    return { nPlayers, W, H, N, cells, step, tip, target, start, progress, at: (r, c) => at.get(r * 16 + c) ?? -1 };
}
const LAYOUTS = {};
export const layout = (nPlayers) => LAYOUTS[nPlayers] || (LAYOUTS[nPlayers] = makeLayout(nPlayers === 2 ? 2 : 4));

export function createState(nPlayers = 2) {
    const L = layout(nPlayers);
    return { nPlayers: L.nPlayers, grid: Int8Array.from(L.start), turn: 0, ply: 0, stuck: false };
}
export function cloneState(s) {
    return { nPlayers: s.nPlayers, grid: s.grid.slice(), turn: s.turn, ply: s.ply, stuck: s.stuck };
}
export const currentColor = (s) => turnOrder(s.nPlayers)[s.turn];

const forwardOk = (color, d) => { const k = (d - FORWARD[color] + 8) % 8; return k <= 2 || k >= 6; };
const turnOk = (prev, d) => { const k = Math.abs(prev - d); return k <= 1 || k === 7; };

// One step of a stone standing on `from`.
//   walk   to an empty neighbour, forwards or sideways
//   leap   over a neighbouring stone onto the empty field straight behind it; a rival's stone is captured
//   faith  over a rival's stone where the floor ends: both stones leave the game
// After a leap the same stone may leap again (prevDir >= 0), turning by 45° at most.
// step = { type, from, to, over, dir, capture }   (to = -1 for a Leap of Faith)
export function stepsFrom(s, from, prevDir = -1, out = []) {
    const L = layout(s.nPlayers), g = s.grid, color = g[from];
    for (let d = 0; d < 8; d++) {
        const a = L.step[from * 8 + d];
        if (a < 0 || !forwardOk(color, d)) continue;
        if (!g[a]) { if (prevDir < 0) out.push({ type: 'walk', from, to: a, over: -1, dir: d, capture: 0 }); continue; }
        if (prevDir >= 0 && !turnOk(prevDir, d)) continue;
        const b = L.step[a * 8 + d];
        if (b < 0) { if (g[a] !== color) out.push({ type: 'faith', from, to: -1, over: a, dir: d, capture: g[a] }); continue; }
        if (!g[b]) out.push({ type: 'leap', from, to: b, over: a, dir: d, capture: g[a] !== color ? g[a] : 0 });
    }
    return out;
}

function applyStep(g, st) {
    const color = g[st.from];
    g[st.from] = 0;
    if (st.capture) g[st.over] = 0;
    if (st.to >= 0) g[st.to] = color;
}

// Every complete move of one stone: move = { from, steps[] }. A chain of leaps may stop after any leap.
export function movesFrom(s, from, out = []) {
    const L = layout(s.nPlayers), color = s.grid[from], goal = L.target[color];
    const rec = (g, at, prevDir, steps) => {
        for (const st of stepsFrom({ nPlayers: s.nPlayers, grid: g }, at, prevDir)) {
            const next = steps.concat(st);
            out.push({ from, steps: next });
            if (st.type !== 'leap' || st.to === goal || next.length >= 12) continue;
            const g2 = g.slice(); applyStep(g2, st);
            rec(g2, st.to, st.dir, next);
        }
    };
    rec(s.grid, from, -1, []);
    return out;
}

export function allMoves(s, color = currentColor(s)) {
    const out = [];
    for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === color) movesFrom(s, i, out);
    return out;
}

function hasMove(s, color) {
    const tmp = [];
    for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === color && stepsFrom(s, i, -1, tmp).length) return true;
    return false;
}

// Applies a move in place. Returns the steps that were taken, each with the colour that moved.
export function applyMove(s, m, wantEvents = true) {
    const ev = wantEvents ? [] : null, color = s.grid[m.from];
    for (const st of m.steps) { applyStep(s.grid, st); ev && ev.push({ ...st, color }); }
    s.ply++;
    // the next player who still has a stone that can move
    const n = s.nPlayers, order = turnOrder(n);
    let skipped = 0;
    do { s.turn = (s.turn + 1) % n; skipped++; } while (skipped <= n && !hasMove(s, order[s.turn]));
    s.stuck = skipped > n;
    return ev;
}

export function countStones(s) {
    const n = [0, 0, 0, 0, 0];
    for (const v of s.grid) n[v]++;
    return n;
}

// Returns null while the game runs, else { winner: colour | 0, reason }.
export function outcome(s) {
    const L = layout(s.nPlayers), order = turnOrder(s.nPlayers);
    for (const c of order) if (s.grid[L.target[c]] === c) return { winner: c, reason: 'artemis' };
    const counts = countStones(s), alive = order.filter((c) => counts[c] > 0);
    if (alive.length === 1) return { winner: alive[0], reason: 'last' };
    if (alive.length === 0) return { winner: 0, reason: 'last' };
    if (s.stuck) return { winner: 0, reason: 'stuck' };
    return null;
}

export function positionKey(s) {
    return s.turn + ':' + Array.prototype.join.call(s.grid, '');
}
