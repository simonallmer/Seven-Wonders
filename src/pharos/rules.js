// PHAROS — pure rules. Game design: Simon Allmer.
// No rendering, no DOM: this module is shared by the game, the AI worker and the tests.
//
// Stones cannot move by themselves. A stone moves one field when another stone of its colour, in the
// same row or column with no rival between them, sends it light. Every stone has one light per turn.
// 2 players: 9 × 9; White holds the two end rows, Black the two side columns, ten stones each.
// 4 players: 11 × 11, one edge each, seven stones; opposite edges (White + Black, Red + Blue) are allies:
// they share light and do not take each other, but only one player wins.
// Five fields are beacons: the centre and the four corners.

export const WHITE = 1, BLACK = 2, RED = 3, BLUE = 4;
export const COLOR_NAMES = ['', 'White', 'Black', 'Red', 'Blue'];
export const STEP = [[-1, 0], [0, 1], [1, 0], [0, -1]];
const BEACON = 1000; // light ids from here on are beacons

export function turnOrder(nPlayers) {
    return nPlayers === 2 ? [WHITE, BLACK] : [WHITE, RED, BLACK, BLUE];
}

function makeLayout(nPlayers) {
    const S = nPlayers === 2 ? 9 : 11, N = S * S, last = S - 1, mid = last / 2;
    const nb = new Int16Array(N * 4).fill(-1);
    for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) STEP.forEach(([dr, dc], d) => {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < S && cc < S) nb[(r * S + c) * 4 + d] = rr * S + cc;
    });
    const beacons = [0, last, mid * S + mid, last * S, last * S + last];
    const beaconAt = new Int8Array(N).fill(-1);
    beacons.forEach((i, b) => { beaconAt[i] = b; });
    const start = new Int8Array(N);
    for (let k = 2; k <= last - 2; k++) {
        if (nPlayers === 2) { start[k] = WHITE; start[last * S + k] = WHITE; start[k * S] = BLACK; start[k * S + last] = BLACK; }
        else { start[last * S + k] = WHITE; start[k] = BLACK; start[k * S] = RED; start[k * S + last] = BLUE; }
    }
    return { nPlayers, S, N, nb, beacons, beaconAt, start };
}
const LAYOUTS = {};
export const layout = (nPlayers) => LAYOUTS[nPlayers] || (LAYOUTS[nPlayers] = makeLayout(nPlayers === 2 ? 2 : 4));

export function createState(nPlayers = 2) {
    const L = layout(nPlayers);
    // lit[b]: the colour beacon b burns in, or 0
    return { nPlayers: L.nPlayers, grid: Int8Array.from(L.start), lit: new Int8Array(5), out: new Uint8Array(5), turn: 0, ply: 0, feud: 0 };
}
export function cloneState(s) {
    return { nPlayers: s.nPlayers, grid: s.grid.slice(), lit: s.lit.slice(), out: s.out.slice(), turn: s.turn, ply: s.ply, feud: s.feud };
}
export const currentColor = (s) => turnOrder(s.nPlayers)[s.turn];
// with four players the colours on opposite edges stand together
// (until only the two partners are left: then the alliance is over — s.feud)
export const allied = (s, a, b) => a === b || (s.nPlayers === 4 && !s.feud && a > 0 && b > 0 && ((a - 1) >> 1) === ((b - 1) >> 1));

export function countStones(s) {
    const n = [0, 0, 0, 0, 0];
    for (const v of s.grid) n[v]++;
    return n;
}
export function countBeacons(s) {
    const n = [0, 0, 0, 0, 0];
    for (const v of s.lit) n[v]++;
    return n;
}

// The lights that could move the stone of `color` standing on `at`:
// friendly stones in its row and column up to the first rival (ids = their field), and friendly beacons in
// its row or column at any distance — a beacon's light is not stopped by stones — except the one it stands on.
export function lightsFor(s, at, color, out = []) {
    const L = layout(s.nPlayers), g = s.grid;
    for (let d = 0; d < 4; d++) {
        for (let j = L.nb[at * 4 + d]; j >= 0; j = L.nb[j * 4 + d]) {
            const v = g[j];
            if (!v) continue;
            if (!allied(s, v, color)) break;
            out.push(j);
        }
    }
    const r = Math.floor(at / L.S), c = at % L.S;
    for (let b = 0; b < 5; b++) {
        const i = L.beacons[b];
        if (i === at || !s.lit[b] || !allied(s, s.lit[b], color)) continue;
        if (Math.floor(i / L.S) === r || i % L.S === c) out.push(BEACON + b);
    }
    return out;
}
export const isBeaconLight = (id) => id >= BEACON;
export const beaconOf = (id) => id - BEACON;

// Walks a stone along `path` on a copy of the position. Returns null if a step is impossible, else
// { state, lights[] (what could power each step), captures[], lit[] (beacons it lit) }.
function walk(s, from, path) {
    const L = layout(s.nPlayers), t = cloneState(s), g = t.grid, color = g[from];
    const lights = [], captures = [], lit = [];
    let at = from;
    for (const to of path) {
        let ok = false;
        for (let d = 0; d < 4; d++) if (L.nb[at * 4 + d] === to) ok = true;
        if (!ok || (g[to] && allied(t, g[to], color))) return null;
        const ls = lightsFor(t, at, color);
        if (!ls.length) return null;
        lights.push(ls);
        captures.push(g[to]);
        g[to] = color; g[at] = 0; at = to;
        const b = L.beaconAt[to];
        lit.push(b >= 0 && t.lit[b] !== color ? b : -1);
        if (b >= 0) t.lit[b] = color;
    }
    return { state: t, lights, captures, lit };
}

// Every stone and every beacon gives one light per turn: can each step be given a light of its own?
// Returns the lights chosen, one per step, or null.
function assign(lights) {
    const n = lights.length, used = new Set(), pick = new Array(n);
    // the steps with the fewest lights choose first
    const order = lights.map((_, i) => i).sort((a, b) => lights[a].length - lights[b].length);
    const rec = (k) => {
        if (k === n) return true;
        const i = order[k];
        for (const id of lights[i]) {
            if (used.has(id)) continue;
            used.add(id); pick[i] = id;
            if (rec(k + 1)) return true;
            used.delete(id);
        }
        return false;
    };
    return rec(0) ? pick : null;
}

// may the stone on `from` walk this path in one turn? returns { state, lights, captures, lit, pick } or null
export function tryPath(s, from, path) {
    const w = walk(s, from, path);
    if (!w) return null;
    const pick = assign(w.lights);
    return pick ? Object.assign(w, { pick }) : null;
}
// the fields the stone may step to next, having walked `path` already
export function nextSteps(s, from, path) {
    const L = layout(s.nPlayers), at = path.length ? path[path.length - 1] : from, out = [];
    for (let d = 0; d < 4; d++) {
        const to = L.nb[at * 4 + d];
        if (to < 0) continue;
        const w = tryPath(s, from, path.concat(to));
        if (w) out.push({ to, capture: w.captures[w.captures.length - 1] });
    }
    return out;
}

// move = { from, path[] }: one stone, one or more steps. Paths are listed up to `maxLen` steps;
// only one path is kept for each different result.
export function movesFrom(s, from, maxLen = 4, out = []) {
    const seen = new Set();
    const rec = (path) => {
        for (const st of nextSteps(s, from, path)) {
            const p = path.concat(st.to), w = tryPath(s, from, p);
            const key = st.to + ':' + Array.prototype.join.call(w.state.grid, '') + Array.prototype.join.call(w.state.lit, '');
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ from, path: p });
            if (p.length < maxLen) rec(p);
        }
    };
    rec([]);
    return out;
}
export function allMoves(s, maxLen = 4, color = currentColor(s)) {
    const out = [];
    for (let i = 0; i < s.grid.length; i++) if (s.grid[i] === color) movesFrom(s, i, maxLen, out);
    return out;
}
export function canMove(s, color) {
    const L = layout(s.nPlayers), g = s.grid;
    for (let i = 0; i < g.length; i++) {
        if (g[i] !== color) continue;
        let free = false;
        for (let d = 0; d < 4; d++) { const j = L.nb[i * 4 + d]; if (j >= 0 && !(g[j] && allied(s, g[j], color))) free = true; }
        if (free && lightsFor(s, i, color).length) return true;
    }
    return false;
}

// Applies a move in place. Returns the list of things that happened, for the view.
export function applyMove(s, m, wantEvents = true) {
    const L = layout(s.nPlayers), ev = wantEvents ? [] : null, color = s.grid[m.from], order = turnOrder(s.nPlayers);
    const w = tryPath(s, m.from, m.path);
    if (ev) {
        let at = m.from;
        m.path.forEach((to, k) => { ev.push({ type: 'step', from: at, to, color, light: w.pick[k], capture: w.captures[k], lit: w.lit[k] }); at = to; });
    }
    s.grid = w.state.grid; s.lit = w.state.lit;
    s.ply++;
    const partners = () => { const a = order.filter((x) => !s.out[x]); if (a.length === 2 && allied({ nPlayers: 4, feud: 0 }, a[0], a[1]) && s.nPlayers === 4 && !s.feud) { s.feud = 1; ev && ev.push({ type: 'feud', colors: a }); } };
    partners();
    // the next player; whoever cannot move on their turn has lost
    for (let k = 0; k < s.nPlayers; k++) {
        s.turn = (s.turn + 1) % s.nPlayers;
        const c = order[s.turn];
        if (s.out[c]) continue;
        if (order.filter((x) => !s.out[x]).length < 2) break;
        if (canMove(s, c)) break;
        s.out[c] = 1;
        const cells = [];
        if (s.nPlayers > 2) { // their stones leave the board and their beacons go dark
            for (let i = 0; i < L.N; i++) if (s.grid[i] === c) { cells.push(i); s.grid[i] = 0; }
            for (let b = 0; b < 5; b++) if (s.lit[b] === c) s.lit[b] = 0;
        }
        ev && ev.push({ type: 'out', color: c, cells });
        partners();
    }
    return ev;
}

// Returns null while the game runs, else { winner: colour | 0, reason }.
export function outcome(s) {
    const alive = turnOrder(s.nPlayers).filter((c) => !s.out[c]);
    if (alive.length === 1) return { winner: alive[0], reason: 'dark' };
    if (alive.length === 0) return { winner: 0, reason: 'dark' };
    return null;
}

export function positionKey(s) {
    return s.turn + (s.feud ? 'f' : ':') + Array.prototype.join.call(s.grid, '') + ':' + Array.prototype.join.call(s.lit, '');
}
