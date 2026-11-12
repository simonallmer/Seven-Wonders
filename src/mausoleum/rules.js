// MAUSOLEUM — pure rules. Game design: Simon Allmer.
// No rendering, no DOM: this module is shared by the game, the AI worker and the tests.
//
// The fields form a network of triangles: every field has up to six neighbours, and lines run
// through it in six directions.
// 2 players: a hexagon of rows 4-5-6-7-8-7-6-5-4; each side fills its two outer rows (9 stones).
// 4 players: a long barrow of rows 8-9-10-11-10-9-8; each side holds a corner wedge (8 stones).
// A captured stone takes its field with it: the field collapses into a pit that stays for the rest
// of the game.

export const WHITE = 1, BLACK = 2, RED = 3, BLUE = 4, PIT = 5;
export const COLOR_NAMES = ['', 'White', 'Black', 'Red', 'Blue'];
export const MIN_STONES = 4;
const isStone = (v) => v >= 1 && v <= 4;

export function turnOrder(nPlayers) {
    return nPlayers === 2 ? [WHITE, BLACK] : [WHITE, RED, BLACK, BLUE];
}

function makeLayout(nPlayers) {
    const two = nPlayers === 2, rows = two ? [4, 5, 6, 7, 8, 7, 6, 5, 4] : [8, 9, 10, 11, 10, 9, 8];
    const mid = (rows.length - 1) / 2, x = [], z = [], rowOf = [], start = [];
    rows.forEach((len, r) => {
        const band = Math.floor(len / 3);
        for (let c = 0; c < len; c++) {
            x.push(c - (len - 1) / 2);
            // white sits on the near side: the two-player board is turned so its first rows face the camera
            z.push((two ? mid - r : r - mid) * Math.sqrt(3) / 2);
            rowOf.push(r);
            let s = 0;
            if (two) s = r <= 1 ? WHITE : r >= rows.length - 2 ? BLACK : 0;
            else if (r !== mid) { if (c < band) s = r < mid ? RED : WHITE; else if (c >= len - band) s = r < mid ? BLACK : BLUE; }
            start.push(s);
        }
    });
    const N = x.length;
    // step[i * 6 + d]: the neighbour of i in direction d (60° apart), or -1
    const step = new Int8Array(N * 6).fill(-1), degree = new Uint8Array(N);
    for (let i = 0; i < N; i++) for (let d = 0; d < 6; d++) {
        const tx = x[i] + Math.cos(d * Math.PI / 3), tz = z[i] + Math.sin(d * Math.PI / 3);
        for (let j = 0; j < N; j++) if (Math.abs(x[j] - tx) < 0.01 && Math.abs(z[j] - tz) < 0.01) { step[i * 6 + d] = j; degree[i]++; break; }
    }
    return { nPlayers, N, x, z, rowOf, start, step, degree };
}
const LAYOUTS = {};
export const layout = (nPlayers) => LAYOUTS[nPlayers] || (LAYOUTS[nPlayers] = makeLayout(nPlayers === 2 ? 2 : 4));

export function createState(nPlayers = 2) {
    const L = layout(nPlayers);
    return { nPlayers: L.nPlayers, grid: Int8Array.from(L.start), out: new Uint8Array(5), turn: 0, lastPushed: -1, ply: 0 };
}
export function cloneState(s) {
    return { nPlayers: s.nPlayers, grid: s.grid.slice(), out: s.out.slice(), turn: s.turn, lastPushed: s.lastPushed, ply: s.ply };
}
export const currentColor = (s) => turnOrder(s.nPlayers)[s.turn];

export function countStones(s) {
    const n = [0, 0, 0, 0, 0, 0];
    for (const v of s.grid) n[v]++;
    return n;
}

// a stone with one free neighbour or none is trapped: it can neither glide nor push
export function isTrapped(s, i) {
    const L = layout(s.nPlayers);
    let free = 0;
    for (let d = 0; d < 6; d++) { const j = L.step[i * 6 + d]; if (j >= 0 && !s.grid[j]) free++; }
    return free <= 1;
}

// move = { type: 'glide', from, to }               slide along a line to the last free field
//        { type: 'push', from, to, pushTo, kill }  step onto a neighbouring stone's field and shove it one on;
//                                                  shoved into a pit it is lost (kill)
export function movesFrom(s, from, out = []) {
    if (isTrapped(s, from)) return out;
    const L = layout(s.nPlayers), g = s.grid;
    for (let d = 0; d < 6; d++) {
        const a = L.step[from * 6 + d];
        if (a < 0) continue;
        if (!g[a]) {
            let to = a;
            for (let n = L.step[to * 6 + d]; n >= 0 && !g[n]; n = L.step[n * 6 + d]) to = n;
            out.push({ type: 'glide', from, to });
        } else if (isStone(g[a]) && a !== s.lastPushed) { // a stone that was just pushed cannot be pushed again at once
            const b = L.step[a * 6 + d];
            if (b < 0) continue; // nothing is pushed over the edge
            if (!g[b]) out.push({ type: 'push', from, to: a, pushTo: b, kill: false });
            else if (g[b] === PIT) out.push({ type: 'push', from, to: a, pushTo: b, kill: true });
        }
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
    for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === color && movesFrom(s, i, tmp).length) return true;
    return false;
}

// Encirclement: a stone with no free neighbour — stones, pits and the edge all close it in — falls when more
// rival stones than friendly ones stand around it. All such stones fall at once; their fields become pits,
// which may close in further stones. Returns the waves of fallen stones.
function collapse(s, ev) {
    const L = layout(s.nPlayers), g = s.grid;
    for (;;) {
        const fall = [];
        for (let i = 0; i < g.length; i++) {
            const v = g[i];
            if (!isStone(v)) continue;
            let free = 0, friends = 0, rivals = 0;
            for (let d = 0; d < 6; d++) {
                const j = L.step[i * 6 + d]; if (j < 0) continue;
                const w = g[j];
                if (!w) { free++; break; }
                if (w === v) friends++; else if (w !== PIT) rivals++;
            }
            if (!free && rivals > friends) fall.push({ at: i, color: v });
        }
        if (!fall.length) return;
        for (const f of fall) g[f.at] = PIT;
        ev && ev.push({ type: 'collapse', cells: fall });
    }
}

function eliminate(s, c, ev, reason) {
    s.out[c] = 1;
    if (s.nPlayers === 2) return; // with two players the game is over; the stones stay where they are
    const cells = [];
    for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === c) { cells.push({ at: i, color: c }); s.grid[i] = PIT; }
    ev && ev.push({ type: 'out', color: c, reason, cells });
}

// after anything fell: who is below four stones?
function settle(s, ev) {
    for (;;) {
        collapse(s, ev);
        const n = countStones(s);
        let again = false;
        for (const c of turnOrder(s.nPlayers)) if (!s.out[c] && n[c] < MIN_STONES) { eliminate(s, c, ev, 'few'); again = s.nPlayers > 2; }
        if (!again) return;
    }
}

// Applies a move in place. Returns the list of things that happened, for the view.
export function applyMove(s, m, wantEvents = true) {
    const g = s.grid, ev = wantEvents ? [] : null, color = g[m.from];
    if (m.type === 'glide') {
        g[m.to] = color; g[m.from] = 0; s.lastPushed = -1;
        ev && ev.push({ type: 'glide', from: m.from, to: m.to, color });
    } else {
        const pushed = g[m.to];
        if (!m.kill) g[m.pushTo] = pushed;
        g[m.to] = color; g[m.from] = 0;
        s.lastPushed = m.kill ? -1 : m.pushTo;
        ev && ev.push({ type: 'push', from: m.from, to: m.to, pushTo: m.pushTo, kill: m.kill, color, pushed });
    }
    settle(s, ev);
    s.ply++;
    // the next player who is still in the game; one who cannot move at all is entombed
    const n = s.nPlayers, order = turnOrder(n);
    for (let k = 0; k < n; k++) {
        s.turn = (s.turn + 1) % n;
        const c = order[s.turn];
        if (s.out[c]) continue;
        if (order.filter((x) => !s.out[x]).length < 2) break;
        if (hasMove(s, c)) break;
        eliminate(s, c, ev, 'entombed');
        settle(s, ev);
    }
    return ev;
}

// Returns null while the game runs, else { winner: colour | 0, reason }.
export function outcome(s) {
    const alive = turnOrder(s.nPlayers).filter((c) => !s.out[c]);
    if (alive.length === 1) return { winner: alive[0], reason: 'last' };
    if (alive.length === 0) return { winner: 0, reason: 'last' };
    return null;
}

export function positionKey(s) {
    return s.turn + ':' + s.lastPushed + ':' + Array.prototype.join.call(s.grid, '');
}
