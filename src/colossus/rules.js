// COLOSSUS — pure rules. Game design: Simon Allmer.
// No rendering, no DOM: this module is shared by the game, the AI worker and the tests.
//
// The board is a square with a short arm on each side: 2 players 9 × 9 inside an 11 × 11 cross,
// 4 players 11 × 11 inside a 13 × 13 cross. The middle field of every arm is a direction field.
// While a stone stands on a direction field the whole board tilts toward that side.

export const WHITE = 1, BLACK = 2, RED = 3, BLUE = 4;
export const COLOR_NAMES = ['', 'White', 'Black', 'Red', 'Blue'];
export const MIN_STONES = 4;
export const STEP = [[-1, 0], [0, 1], [1, 0], [0, -1]]; // up, right, down, left — the directions of a tilt too
export const DIR_NAMES = ['north', 'east', 'south', 'west'];

export function turnOrder(nPlayers) {
    return nPlayers === 2 ? [WHITE, BLACK] : [WHITE, RED, BLACK, BLUE];
}

function makeLayout(nPlayers) {
    const S = nPlayers === 2 ? 11 : 13, mid = (S - 1) / 2, last = S - 1, N = S * S;
    const active = new Uint8Array(N);
    for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) {
        const core = r >= 1 && r < last && c >= 1 && c < last;
        const arm = ((r === 0 || r === last) && Math.abs(c - mid) <= 1) || ((c === 0 || c === last) && Math.abs(r - mid) <= 1);
        if (core || arm) active[r * S + c] = 1;
    }
    const nb = new Int16Array(N * 4).fill(-1);
    for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) STEP.forEach(([dr, dc], d) => {
        const rr = r + dr, cc = c + dc;
        if (active[r * S + c] && rr >= 0 && cc >= 0 && rr < S && cc < S && active[rr * S + cc]) nb[(r * S + c) * 4 + d] = rr * S + cc;
    });
    // field[d]: the direction field that tilts the board toward d
    const field = [mid, mid * S + last, last * S + mid, mid * S];
    const start = new Int8Array(N), put = (r, c, v) => { start[r * S + c] = v; };
    if (nPlayers === 2) {
        // each side holds two opposite corners, six stones in each: white near-left and far-right
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) {
            put(last - 1 - i, 1 + j, WHITE); put(1 + i, last - 1 - j, WHITE);
            put(1 + i, 1 + j, BLACK); put(last - 1 - i, last - 1 - j, BLACK);
        }
    } else {
        // ten stones in a corner each, clockwise from white on the near-left
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4 - i; j++) {
            put(last - 1 - i, 1 + j, WHITE); put(1 + i, 1 + j, RED); put(1 + i, last - 1 - j, BLACK); put(last - 1 - i, last - 1 - j, BLUE);
        }
    }
    // the order in which fields are visited so that a tilt toward d settles in one sweep
    const sweep = STEP.map(([dr, dc]) => {
        const order = [];
        for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) {
            const lead = dr > 0 || dc > 0 ? S - 1 - a : a; // start at the side the board leans to
            const i = dr ? lead * S + b : b * S + lead;
            if (active[i]) order.push(i);
        }
        return order;
    });
    return { nPlayers, S, N, active, nb, field, start, sweep };
}
const LAYOUTS = {};
export const layout = (nPlayers) => LAYOUTS[nPlayers] || (LAYOUTS[nPlayers] = makeLayout(nPlayers === 2 ? 2 : 4));

export function createState(nPlayers = 2) {
    const L = layout(nPlayers);
    // pushed[i]: 0, or 1 + the direction the stone on i was last pushed in (it cannot be pushed straight back)
    return { nPlayers: L.nPlayers, grid: Int8Array.from(L.start), pushed: new Int8Array(L.N), lastPushed: -1, out: new Uint8Array(5), turn: 0, ply: 0, passes: 0 };
}
export function cloneState(s) {
    return { nPlayers: s.nPlayers, grid: s.grid.slice(), pushed: s.pushed.slice(), lastPushed: s.lastPushed, out: s.out.slice(), turn: s.turn, ply: s.ply, passes: s.passes };
}
export const currentColor = (s) => turnOrder(s.nPlayers)[s.turn];

export function countStones(s) {
    const n = [0, 0, 0, 0, 0];
    for (const v of s.grid) n[v]++;
    return n;
}

// move = { type: 'run', from, to }            straight over free fields, as far as you like
//        { type: 'push', from, to, pushTo }   take the place of a neighbouring stone and shove it one field on
//        { type: 'pass' }
export function movesFrom(s, from, out = []) {
    const L = layout(s.nPlayers), g = s.grid;
    for (let d = 0; d < 4; d++) {
        const a = L.nb[from * 4 + d];
        if (a < 0) continue;
        if (!g[a]) { for (let to = a; to >= 0 && !g[to]; to = L.nb[to * 4 + d]) out.push({ type: 'run', from, to }); continue; }
        const b = L.nb[a * 4 + d];
        if (b < 0 || g[b]) continue;
        if (a === s.lastPushed) continue;                 // the stone that was just pushed is left alone for a turn
        if (s.pushed[a] === 1 + ((d + 2) % 4)) continue;  // and no stone is shoved straight back the way it came
        out.push({ type: 'push', from, to: a, pushTo: b });
    }
    return out;
}
export function allMoves(s, color = currentColor(s)) {
    const out = [];
    for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === color) movesFrom(s, i, out);
    return out.length ? out : [{ type: 'pass' }];
}

// the directions the board leans in right now: every occupied direction field, opposite ones cancelling
export function leaning(s) {
    const L = layout(s.nPlayers), on = L.field.map((i) => s.grid[i] !== 0);
    return [0, 1, 2, 3].filter((d) => on[d] && !on[(d + 2) % 4]);
}

// the name of a lean: 'west', or 'north-west' for two neighbouring directions at once
export function leanName(dirs) {
    if (dirs.length === 1) return DIR_NAMES[dirs[0]];
    const ns = dirs.find((d) => d % 2 === 0), ew = dirs.find((d) => d % 2 === 1);
    return DIR_NAMES[ns] + '-' + DIR_NAMES[ew];
}

// Tilts the board toward d — or, given two neighbouring directions, diagonally between them.
// Every stone slides until the edge or another stone stops it. Returns the slides.
export function tilt(s, d) {
    const L = layout(s.nPlayers), g = s.grid, moves = [];
    if (Array.isArray(d) && d.length === 1) d = d[0];
    if (!Array.isArray(d)) {
        for (const i of L.sweep[d]) {
            if (!g[i]) continue;
            let to = i;
            for (let n = L.nb[to * 4 + d]; n >= 0 && !g[n]; n = L.nb[n * 4 + d]) to = n;
            if (to !== i) { g[to] = g[i]; g[i] = 0; moves.push({ from: i, to, color: g[to] }); }
        }
    } else { // diagonal: each stone steps corner-wise while that field is free
        const dr = STEP[d[0]][0] + STEP[d[1]][0], dc = STEP[d[0]][1] + STEP[d[1]][1], S = L.S;
        const from = new Map(); // where each stone now standing on a field started
        for (let moved = true, n = 0; moved && n < S * 2; n++) {
            moved = false;
            for (let a = 0; a < S; a++) for (let b = 0; b < S; b++) {
                const r = dr > 0 ? S - 1 - a : a, c = dc > 0 ? S - 1 - b : b, i = r * S + c;
                if (!g[i]) continue;
                const rr = r + dr, cc = c + dc, j = rr * S + cc;
                if (rr < 0 || cc < 0 || rr >= S || cc >= S || !L.active[j] || g[j]) continue;
                g[j] = g[i]; g[i] = 0; from.set(j, from.has(i) ? from.get(i) : i); from.delete(i); moved = true;
            }
        }
        for (const [to, f] of from) if (to !== f) moves.push({ from: f, to, color: g[to] });
    }
    if (moves.length) { s.pushed.fill(0); s.lastPushed = -1; } // a tilt shakes off the memory of pushes
    return moves;
}

// Hades: a group of one colour, joined along rows and columns, with no free field beside it is removed.
export function hades(s) {
    const L = layout(s.nPlayers), g = s.grid, seen = new Uint8Array(L.N), gone = [];
    for (let i = 0; i < L.N; i++) {
        if (!g[i] || seen[i]) continue;
        const group = [i]; let free = false;
        seen[i] = 1;
        for (let k = 0; k < group.length; k++) for (let d = 0; d < 4; d++) {
            const j = L.nb[group[k] * 4 + d];
            if (j < 0) continue;
            if (!g[j]) free = true;
            else if (g[j] === g[i] && !seen[j]) { seen[j] = 1; group.push(j); }
        }
        if (!free) for (const j of group) gone.push({ at: j, color: g[j] });
    }
    for (const x of gone) { g[x.at] = 0; s.pushed[x.at] = 0; }
    return gone;
}

// Applies a move in place. Returns the list of things that happened, for the view.
export function applyMove(s, m, wantEvents = true) {
    const L = layout(s.nPlayers), g = s.grid, ev = wantEvents ? [] : null, order = turnOrder(s.nPlayers);
    const before = L.field.map((i) => g[i] !== 0);
    if (m.type === 'run') {
        g[m.to] = g[m.from]; g[m.from] = 0;
        s.pushed[m.from] = 0; s.pushed[m.to] = 0; s.lastPushed = -1;
        ev && ev.push({ type: 'run', from: m.from, to: m.to });
    } else if (m.type === 'push') {
        const d = STEP.findIndex(([dr, dc]) => m.pushTo - m.to === dr * L.S + dc);
        g[m.pushTo] = g[m.to]; g[m.to] = g[m.from]; g[m.from] = 0;
        s.pushed[m.from] = 0; s.pushed[m.to] = 0; s.pushed[m.pushTo] = 1 + d; s.lastPushed = m.pushTo;
        ev && ev.push({ type: 'push', from: m.from, to: m.to, pushTo: m.pushTo });
    }
    s.passes = m.type === 'pass' ? s.passes + 1 : 0;
    // The board answers after every move, for as long as direction fields stay occupied. A Hades ends the
    // sliding at once. Opposite fields cancel. A field stepped onto in this move tilts the board first, then every
    // other held field once; two neighbouring fields held from before tilt it diagonally between them.
    // A stone that slides onto a direction field tilts the board once more.
    let fresh = [0, 1, 2, 3].filter((d) => !before[d] && g[L.field[d]] !== 0), stop = false;
    const checkHades = () => { const gone = hades(s); if (gone.length) { ev && ev.push({ type: 'hades', cells: gone }); stop = true; } };
    if (m.type !== 'pass') checkHades();
    for (let round = 0; round < 6 && m.type !== 'pass' && !stop; round++) {
        const lean = leaning(s);
        if (!lean.length) break;
        const first = lean.filter((d) => fresh.includes(d));
        const plan = first.length ? [...first, ...lean.filter((d) => !first.includes(d))].map((d) => [d]) : [lean];
        const held = L.field.map((i) => g[i] !== 0);
        for (const dirs of plan) {
            const moves = tilt(s, dirs);
            if (moves.length) ev && ev.push({ type: 'tilt', dir: dirs.length === 1 ? dirs[0] : -1, dirs, moves });
            checkHades();
            if (stop) break;
        }
        fresh = [0, 1, 2, 3].filter((d) => !held[d] && g[L.field[d]] !== 0);
        if (!fresh.length) break;
    }
    const counts = countStones(s);
    for (const c of order) if (!s.out[c] && counts[c] < MIN_STONES) { s.out[c] = 1; ev && ev.push({ type: 'out', color: c }); }
    s.ply++;
    let k = 0;
    do { s.turn = (s.turn + 1) % s.nPlayers; k++; } while (k <= s.nPlayers && s.out[order[s.turn]]);
    return ev;
}

// Returns null while the game runs, else { winner: colour | 0, reason }.
export function outcome(s) {
    const alive = turnOrder(s.nPlayers).filter((c) => !s.out[c]);
    if (alive.length === 1) return { winner: alive[0], reason: 'hades' };
    if (alive.length === 0) return { winner: 0, reason: 'hades' };
    if (s.passes >= alive.length) return { winner: 0, reason: 'stuck' };
    return null;
}

export function positionKey(s) {
    return s.turn + ':' + s.lastPushed + ':' + Array.prototype.join.call(s.grid, '') + ':' + Array.prototype.join.call(s.pushed, '').replace(/0+$/, '');
}
