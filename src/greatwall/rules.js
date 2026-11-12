// GREAT WALL — pure rules. Game design: Simon Allmer.
// No rendering, no DOM: this module is shared by the game, the AI worker and the tests.
//
// The stones are warriors. Each stands on a field and faces one of eight directions; its shield covers
// its back and both rear flanks.
// 2 players: the walk of the wall, 5 × 15. White's Legendary Field is the middle of the east end,
// Black's the middle of the west end.
// 4 players: two walls crossing, a plus of 5-wide arms on a 25 × 25 lattice; a Legendary Field at
// every tip — White south, Red west, Black north, Blue east.
// A field of the grid holds 0 or colour * 8 + facing.

export const WHITE = 1, BLACK = 2, RED = 3, BLUE = 4;
export const COLOR_NAMES = ['', 'White', 'Black', 'Red', 'Blue'];
export const RESERVE = 10, MIN_FORCE = 4;
// eight directions, clockwise from north (north is row - 1)
export const DIRS = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
export const DIR_NAMES = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const owner = (v) => v >> 3;
export const facing = (v) => v & 7;
const opp = (d) => (d + 4) & 7;
// does the shield of a warrior facing f cover an attack arriving from direction `side` (as seen from the warrior)?
export const shielded = (f, side) => { const k = (side - opp(f) + 8) & 7; return k === 0 || k === 1 || k === 7; };

export function turnOrder(nPlayers) {
    return nPlayers === 2 ? [WHITE, BLACK] : [WHITE, RED, BLACK, BLUE];
}

function makeLayout(nPlayers) {
    const two = nPlayers === 2, rows = two ? 5 : 25, cols = two ? 15 : 25, N = rows * cols;
    const on = new Uint8Array(N);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) on[r * cols + c] = two || (r >= 10 && r <= 14) || (c >= 10 && c <= 14) ? 1 : 0;
    const supply = two ? [-1, 2 * cols + cols - 1, 2 * cols, -1, -1] : [-1, 24 * cols + 12, 12, 12 * cols, 12 * cols + 24];
    // near[i]: the fields one step from i; ring[i]: the fields exactly two steps away, each with the fields between
    const near = [], ring = [];
    for (let i = 0; i < N; i++) {
        const r = Math.floor(i / cols), c = i % cols, a = [], b = [];
        if (on[i]) for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
            const rr = r + dr, cc = c + dc, j = rr * cols + cc;
            if ((!dr && !dc) || rr < 0 || cc < 0 || rr >= rows || cc >= cols || !on[j]) continue;
            if (Math.max(Math.abs(dr), Math.abs(dc)) === 1) { a.push(j); continue; }
            const via = [];
            for (let er = -1; er <= 1; er++) for (let ec = -1; ec <= 1; ec++) {
                const mr = r + er, mc = c + ec, m = mr * cols + mc;
                if ((!er && !ec) || mr < 0 || mc < 0 || mr >= rows || mc >= cols || !on[m]) continue;
                if (Math.max(Math.abs(mr - rr), Math.abs(mc - cc)) === 1) via.push(m);
            }
            if (via.length) b.push({ to: j, via });
        }
        near.push(a); ring.push(b);
    }
    return { nPlayers, rows, cols, N, on, supply, near, ring };
}
const LAYOUTS = {};
export const layout = (nPlayers) => LAYOUTS[nPlayers] || (LAYOUTS[nPlayers] = makeLayout(nPlayers === 2 ? 2 : 4));

export function createState(nPlayers = 2) {
    const L = layout(nPlayers), reserve = new Int8Array(5);
    for (const c of turnOrder(L.nPlayers)) reserve[c] = RESERVE;
    return { nPlayers: L.nPlayers, grid: new Uint8Array(L.N), reserve, out: new Uint8Array(5), turn: 0, ply: 0 };
}
export function cloneState(s) {
    return { nPlayers: s.nPlayers, grid: s.grid.slice(), reserve: s.reserve.slice(), out: s.out.slice(), turn: s.turn, ply: s.ply };
}
export const currentColor = (s) => turnOrder(s.nPlayers)[s.turn];

export function countWarriors(s) {
    const n = [0, 0, 0, 0, 0];
    for (const v of s.grid) if (v) n[v >> 3]++;
    return n;
}
export function forces(s) { // on the wall + in reserve
    const n = countWarriors(s);
    for (let c = 1; c <= 4; c++) n[c] += s.reserve[c];
    return n;
}

// The supply chain of a colour: its Legendary Field (unless a rival stands on it) and every friendly warrior
// linked to it in steps of at most two fields, a step of two needing a field between that no rival holds.
// Returns { chain[], fields[] } — fields are the empty fields within such a step of the chain: where it may place.
export function supplyOf(s, color) {
    const L = layout(s.nPlayers), g = s.grid, root = L.supply[color];
    const inChain = new Uint8Array(L.N), chain = [], fields = new Set();
    if (!g[root] || (g[root] >> 3) === color) { inChain[root] = 1; chain.push(root); }
    const open = (j) => !g[j] || (g[j] >> 3) === color;
    for (let k = 0; k < chain.length; k++) {
        const at = chain[k];
        const reach = (j) => {
            if ((g[j] >> 3) === color) { if (!inChain[j]) { inChain[j] = 1; chain.push(j); } } else if (!g[j]) fields.add(j);
        };
        for (const j of L.near[at]) reach(j);
        for (const { to, via } of L.ring[at]) if (via.some(open)) reach(to);
    }
    return { chain, fields: s.reserve[color] > 0 ? [...fields] : [] };
}

// where the warrior on `from` may walk: up to two fields in any direction, a walk of two needing an empty field between
export function moveTargets(s, from) {
    const L = layout(s.nPlayers), g = s.grid, out = [];
    for (const j of L.near[from]) if (!g[j]) out.push(j);
    for (const { to, via } of L.ring[from]) if (!g[to] && via.some((m) => !g[m])) out.push(to);
    return out;
}

// The flight of an arrow shot by the warrior on `from`.
// It flies straight until it meets a warrior: struck square on the shield it flies back the way it came; on a
// rear flank it turns aside by a quarter; anywhere else the warrior falls and the arrow flies on the way the
// fallen one was facing. Returns { pts: [[row, col], …], marks: [{ i, type, at }], kills: [fields] }.
export function arrow(s, from) {
    const L = layout(s.nPlayers), g = s.grid, gone = new Set(), kills = [], marks = [];
    let r = Math.floor(from / L.cols), c = from % L.cols, v = g[from] & 7;
    const pts = [[r, c]], seen = new Set();
    for (let n = 0; n < 400; n++) {
        const key = r * 1000 + c * 10 + v;
        if (seen.has(key)) { marks.push({ i: pts.length - 1, type: 'spent' }); break; }
        seen.add(key);
        r += DIRS[v][0]; c += DIRS[v][1];
        const i = r * L.cols + c;
        pts.push([r, c]);
        if (r < 0 || c < 0 || r >= L.rows || c >= L.cols || !L.on[i]) { marks.push({ i: pts.length - 1, type: 'out' }); break; }
        const w = g[i];
        if (!w || gone.has(i)) continue;
        const f = w & 7, side = opp(v);
        if (side === opp(f)) { marks.push({ i: pts.length - 1, type: 'reflect', at: i }); v = opp(v); }
        else if (shielded(f, side)) {
            // it glances off toward whichever side carries it further on
            const a = (f + 2) & 7, b = (f + 6) & 7, dot = (d) => DIRS[d][0] * DIRS[v][0] + DIRS[d][1] * DIRS[v][1];
            marks.push({ i: pts.length - 1, type: 'deflect', at: i }); v = dot(b) > dot(a) ? b : a;
        } else { gone.add(i); kills.push(i); marks.push({ i: pts.length - 1, type: 'kill', at: i }); v = f; seen.clear(); }
    }
    return { pts, marks, kills };
}

// the warriors a spin on `at` cuts down: every neighbour whose shield does not cover that side
export function spinKills(s, at) {
    const L = layout(s.nPlayers), g = s.grid, r = Math.floor(at / L.cols), c = at % L.cols, out = [];
    for (let d = 0; d < 8; d++) {
        const rr = r + DIRS[d][0], cc = c + DIRS[d][1], j = rr * L.cols + cc;
        if (rr < 0 || cc < 0 || rr >= L.rows || cc >= L.cols || !L.on[j] || !g[j]) continue;
        if (!shielded(g[j] & 7, opp(d))) out.push(j);
    }
    return out;
}

const hasAction = (s, color) => countWarriors(s)[color] > 0 || supplyOf(s, color).fields.length > 0;

// move = { type: 'place', to, facing }        a warrior from reserve onto a field of your supply
//        { type: 'move', from, to, facing }   walk up to two fields (to may equal from) and face anew
//        { type: 'shoot', from }              an arrow along your facing
//        { type: 'spin', from, facing }       strike all eight fields around, then face anew
// Applies a move in place. Returns the list of things that happened, for the view.
export function applyMove(s, m, wantEvents = true) {
    const L = layout(s.nPlayers), g = s.grid, order = turnOrder(s.nPlayers), color = order[s.turn], ev = wantEvents ? [] : null;
    const fallen = (cells) => cells.map((at) => ({ at, color: g[at] >> 3, facing: g[at] & 7 }));
    if (m.type === 'place') {
        g[m.to] = color * 8 + m.facing; s.reserve[color]--;
        ev && ev.push({ type: 'place', to: m.to, color, facing: m.facing });
    } else if (m.type === 'move') {
        g[m.from] = 0; g[m.to] = color * 8 + m.facing;
        ev && ev.push({ type: 'move', from: m.from, to: m.to, color, facing: m.facing });
    } else if (m.type === 'shoot') {
        const a = arrow(s, m.from), dead = fallen(a.kills);
        ev && ev.push({ type: 'shoot', from: m.from, color, pts: a.pts, marks: a.marks, kills: dead });
        for (const at of a.kills) g[at] = 0;
    } else if (m.type === 'spin') {
        const k = spinKills(s, m.from), dead = fallen(k);
        for (const at of k) g[at] = 0;
        g[m.from] = color * 8 + m.facing;
        ev && ev.push({ type: 'spin', at: m.from, color, kills: dead, facing: m.facing });
    }
    // an army below four warriors, on the wall and in reserve together, is beaten
    const n = forces(s);
    const beaten = (c) => {
        s.out[c] = 1;
        const cells = [];
        if (s.nPlayers > 2) { for (let i = 0; i < L.N; i++) if ((g[i] >> 3) === c) { cells.push({ at: i, color: c, facing: g[i] & 7 }); g[i] = 0; } s.reserve[c] = 0; }
        ev && ev.push({ type: 'out', color: c, cells });
    };
    for (const c of order) if (c !== color && !s.out[c] && n[c] < MIN_FORCE) beaten(c);
    if (!s.out[color] && n[color] < MIN_FORCE && order.some((c) => c !== color && !s.out[c])) beaten(color);
    s.ply++;
    for (let k = 0; k < s.nPlayers; k++) {
        s.turn = (s.turn + 1) % s.nPlayers;
        const c = order[s.turn];
        if (s.out[c]) continue;
        if (order.filter((x) => !s.out[x]).length < 2 || hasAction(s, c)) break;
        beaten(c); // cut off, with nothing left to do
    }
    return ev;
}

// Returns null while the game runs, else { winner: colour | 0, reason }.
export function outcome(s) {
    const alive = turnOrder(s.nPlayers).filter((c) => !s.out[c]);
    if (alive.length === 1) return { winner: alive[0], reason: 'army' };
    if (alive.length === 0) return { winner: 0, reason: 'army' };
    return null;
}

export function positionKey(s) {
    return s.turn + ':' + Array.prototype.join.call(s.grid, '.') + ':' + Array.prototype.join.call(s.reserve, '');
}
