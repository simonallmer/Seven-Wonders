// STATUE — pure rules. Game design: Simon Allmer.
// No rendering, no DOM: this module is shared by the game, the AI worker and the tests.
//
// The floor beneath the throne of Zeus is 11 × 11 fields; the four feet of the throne each take
// 2 × 2 fields out of it. The stones are dice. Every player has eight, all in reserve at the start.
// 4 players: two floors joined along one row (11 × 21), a throne on each; every player may place
// dice only in their own quarter, and nobody may place on the joining row.
//
// A field of the grid holds 0 or colour * 8 + pips.

export const WHITE = 1, BLACK = 2, RED = 3, BLUE = 4;
export const COLOR_NAMES = ['', 'White', 'Black', 'Red', 'Blue'];
export const DICE = 8, MIN_DICE = 4;
export const STEP = [[-1, 0], [0, 1], [1, 0], [0, -1]];
export const owner = (v) => v >> 3;
export const pips = (v) => v & 7;

export function turnOrder(nPlayers) {
    return nPlayers === 2 ? [WHITE, BLACK] : [WHITE, RED, BLACK, BLUE];
}

function makeLayout(nPlayers) {
    const cols = 11, rows = nPlayers === 2 ? 11 : 21, N = rows * cols;
    const hole = new Uint8Array(N);
    for (const base of nPlayers === 2 ? [0] : [0, 10]) for (const r of [3, 4, 6, 7]) for (const c of [3, 4, 6, 7]) hole[(base + r) * cols + c] = 1;
    // nb[i * 4 + d]: the field next to i in direction d, or -1
    const nb = new Int16Array(N * 4).fill(-1);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        if (hole[i]) continue;
        STEP.forEach(([dr, dc], d) => {
            const rr = r + dr, cc = c + dc, j = rr * cols + cc;
            if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && !hole[j]) nb[i * 4 + d] = j;
        });
    }
    // home[colour][i]: may this colour place a die here?
    const home = [null, 1, 2, 3, 4].map((c) => {
        if (!c) return null;
        const h = new Uint8Array(N);
        for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
            const i = r * cols + col;
            if (hole[i]) continue;
            if (nPlayers === 2) { h[i] = 1; continue; }
            if (r === 10 || col === 5) continue; // the joining row and the line between the quarters
            const near = r > 10, left = col < 5;
            h[i] = (c === WHITE && near && left) || (c === RED && !near && left) || (c === BLACK && !near && !left) || (c === BLUE && near && !left) ? 1 : 0;
        }
        return h;
    });
    return { nPlayers, rows, cols, N, hole, nb, home };
}
const LAYOUTS = {};
export const layout = (nPlayers) => LAYOUTS[nPlayers] || (LAYOUTS[nPlayers] = makeLayout(nPlayers === 2 ? 2 : 4));

export function createState(nPlayers = 2) {
    const L = layout(nPlayers);
    const reserve = new Int8Array(5);
    for (const c of turnOrder(L.nPlayers)) reserve[c] = DICE;
    return { nPlayers: L.nPlayers, grid: new Uint8Array(L.N), reserve, out: new Uint8Array(5), turn: 0, forced: 0, ply: 0, passes: 0 };
}
export function cloneState(s) {
    return { nPlayers: s.nPlayers, grid: s.grid.slice(), reserve: s.reserve.slice(), out: s.out.slice(), turn: s.turn, forced: s.forced, ply: s.ply, passes: s.passes };
}
export const currentColor = (s) => turnOrder(s.nPlayers)[s.turn];

export function countDice(s) { // on the floor, per colour
    const n = [0, 0, 0, 0, 0];
    for (const v of s.grid) if (v) n[v >> 3]++;
    return n;
}
export function totals(s) { // floor + reserve
    const n = countDice(s);
    for (let c = 1; c <= 4; c++) n[c] += s.reserve[c];
    return n;
}

// may a die of `color` step onto field j? 0 no, 1 empty, 2 capturing
function stepKind(g, j, color) {
    if (j < 0) return 0;
    const v = g[j];
    if (!v) return 1;
    return (v >> 3) !== color && (v & 7) > 1 ? 2 : 0; // own dice block; a 1 cannot be taken
}
export function canStep(s, i) {
    const L = layout(s.nPlayers), color = s.grid[i] >> 3;
    for (let d = 0; d < 4; d++) if (stepKind(s.grid, L.nb[i * 4 + d], color)) return true;
    return false;
}
// the single steps open to the die on `at`, on a floor that may already be partly walked
export function stepsFrom(s, at, color = s.grid[at] >> 3) {
    const L = layout(s.nPlayers), out = [];
    for (let d = 0; d < 4; d++) { const j = L.nb[at * 4 + d], k = stepKind(s.grid, j, color); if (k) out.push({ to: j, capture: k === 2 }); }
    return out;
}
const hasMovableOne = (s, color) => { for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === color * 8 + 1 && canStep(s, i)) return true; return false; };
// the rivals a Diminish could force to move
export function diminishTargets(s, color = currentColor(s)) {
    return turnOrder(s.nPlayers).filter((c) => c !== color && !s.out[c] && hasMovableOne(s, c));
}

// Every stride of the die on `from`: as many single steps as it shows pips, turning freely, taking every
// rival die above 1 that it steps onto. It stops early only where it cannot step at all.
// One path is kept for each different result.
export function stridesFrom(s, from, out = []) {
    const L = layout(s.nPlayers), g = s.grid.slice(), v = g[from], color = v >> 3, n = v & 7;
    const seen = new Set(), path = [], taken = [];
    g[from] = 0;
    const rec = (at, left) => {
        let moved = false;
        if (left > 0) for (let d = 0; d < 4; d++) {
            const j = L.nb[at * 4 + d], k = stepKind(g, j, color);
            if (!k) continue;
            moved = true;
            const was = g[j];
            if (k === 2) { g[j] = 0; taken.push(j); }
            path.push(j); rec(j, left - 1); path.pop();
            if (k === 2) { g[j] = was; taken.pop(); }
        }
        if (moved || !path.length) return;
        const key = at + ':' + taken.slice().sort().join(',');
        if (!seen.has(key)) { seen.add(key); out.push({ type: 'stride', from, path: path.slice() }); }
    };
    rec(from, n);
    return out;
}

// move = { type: 'place', to } | { type: 'stride', from, path } | { type: 'diminish', at, target } | { type: 'pass' }
export function legalMoves(s) {
    const L = layout(s.nPlayers), g = s.grid, color = currentColor(s), out = [];
    if (s.forced) { // called out by a Diminish: one of the 1s must move
        for (let i = 0; i < g.length; i++) if (g[i] === color * 8 + 1) stridesFrom(s, i, out);
        return out.length ? out : [{ type: 'pass' }];
    }
    if (s.reserve[color] > 0) { const h = L.home[color]; for (let i = 0; i < g.length; i++) if (h[i] && !g[i]) out.push({ type: 'place', to: i }); }
    const targets = diminishTargets(s, color);
    for (let i = 0; i < g.length; i++) {
        if ((g[i] >> 3) !== color) continue;
        stridesFrom(s, i, out);
        if ((g[i] & 7) > 1) for (const target of targets) out.push({ type: 'diminish', at: i, target });
    }
    return out.length ? out : [{ type: 'pass' }];
}

// Applies a move in place. Returns the list of things that happened, for the view.
export function applyMove(s, m, wantEvents = true) {
    const g = s.grid, n = s.nPlayers, order = turnOrder(n), color = order[s.turn], ev = wantEvents ? [] : null;
    const wasForced = s.forced;
    let next = -1;
    s.forced = 0;
    if (m.type === 'place') {
        g[m.to] = color * 8 + 1; s.reserve[color]--;
        ev && ev.push({ type: 'place', to: m.to, color });
    } else if (m.type === 'stride') {
        const v = g[m.from];
        let at = m.from;
        g[at] = 0;
        for (const to of m.path) {
            const hit = g[to];
            ev && ev.push({ type: 'step', from: at, to, color, pips: v & 7, capture: hit ? { color: hit >> 3, pips: hit & 7 } : null });
            g[to] = 0; at = to;
        }
        const grown = (v & 7) % 6 + 1; // a 6 that has moved is a 1 again
        g[at] = color * 8 + grown;
        ev && ev.push({ type: 'value', at, color, pips: grown });
    } else if (m.type === 'diminish') {
        g[m.at]--;
        ev && ev.push({ type: 'value', at: m.at, color, pips: g[m.at] & 7, diminish: true }, { type: 'forced', color: m.target });
        next = order.indexOf(m.target); s.forced = 1;
    } else ev && ev.push({ type: 'pass', color });
    s.passes = m.type === 'pass' && !wasForced ? s.passes + 1 : 0;
    // whoever is left with fewer than four dice is out, and their dice leave the floor
    const tot = totals(s);
    for (const c of order) if (!s.out[c] && tot[c] < MIN_DICE) {
        s.out[c] = 1;
        if (n > 2) {
            const cells = [];
            for (let i = 0; i < g.length; i++) if ((g[i] >> 3) === c) { cells.push(i); g[i] = 0; }
            s.reserve[c] = 0;
            ev && ev.push({ type: 'out', color: c, cells });
        }
    }
    s.ply++;
    if (next >= 0 && !s.out[order[next]]) s.turn = next;
    else { s.forced = 0; let k = 0; do { s.turn = (s.turn + 1) % n; k++; } while (k <= n && s.out[order[s.turn]]); }
    return ev;
}

// Returns null while the game runs, else { winner: colour | 0, reason }.
export function outcome(s) {
    const alive = turnOrder(s.nPlayers).filter((c) => !s.out[c]);
    if (alive.length === 1) return { winner: alive[0], reason: 'dice' };
    if (alive.length === 0) return { winner: 0, reason: 'dice' };
    if (s.passes >= alive.length) return { winner: 0, reason: 'stuck' };
    return null;
}

export function positionKey(s) {
    return s.turn + (s.forced ? 'f' : ':') + Array.prototype.join.call(s.grid, '.') + ':' + Array.prototype.join.call(s.reserve, '');
}
