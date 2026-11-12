// SKYSCRAPER — pure rules. Game design: Simon Allmer.
// No rendering, no DOM: this module is shared by the game, the AI worker and the tests.
//
// The board is the skin of a tower five fields square and ten floors high: every outer block of
// floors 0–8 and the whole of floor 9, the roof. A block has one window on each outward face — two at a
// corner — and a player who lights a block lights all its windows.
// 2 players play on the five upper floors only; 4 players on all ten.

export const WHITE = 1, BLACK = 2, RED = 3, BLUE = 4;
export const COLOR_NAMES = ['', 'White', 'Black', 'Red', 'Blue'];
export const SIZE = 5, ROOF = 9;

export function turnOrder(nPlayers) {
    return nPlayers === 2 ? [WHITE, BLACK] : [WHITE, RED, BLACK, BLUE];
}

function makeLayout(nPlayers) {
    const low = nPlayers === 2 ? 5 : 0;          // the lowest floor in play
    const blocks = [], at = new Int16Array(SIZE * SIZE * (ROOF + 1)).fill(-1);
    const id = (u, v, w) => (w * SIZE + v) * SIZE + u;
    for (let w = low; w <= ROOF; w++) for (let v = 0; v < SIZE; v++) for (let u = 0; u < SIZE; u++) {
        const edge = u === 0 || u === SIZE - 1 || v === 0 || v === SIZE - 1;
        if (!edge && w < ROOF) continue;
        // faces: 0 north (v = 0), 1 east (u = 4), 2 south (v = 4), 3 west (u = 0), 4 roof
        const faces = [];
        if (w === ROOF) faces.push(4);
        else { if (v === 0) faces.push(0); if (u === SIZE - 1) faces.push(1); if (v === SIZE - 1) faces.push(2); if (u === 0) faces.push(3); }
        at[id(u, v, w)] = blocks.length;
        blocks.push({ u, v, w, faces });
    }
    const N = blocks.length, find = (u, v, w) => (u < 0 || v < 0 || w < 0 || u >= SIZE || v >= SIZE || w > ROOF ? -1 : at[id(u, v, w)]);
    // sight[i]: every block in line with i along one axis, with the blocks between (those inside the tower do not count)
    const sight = blocks.map((b, i) => {
        const out = [];
        blocks.forEach((c, j) => {
            if (i === j) return;
            const same = (b.u === c.u) + (b.v === c.v) + (b.w === c.w);
            if (same < 2) return;
            const du = Math.sign(c.u - b.u), dv = Math.sign(c.v - b.v), dw = Math.sign(c.w - b.w), between = [];
            for (let u = b.u + du, v = b.v + dv, w = b.w + dw; u !== c.u || v !== c.v || w !== c.w; u += du, v += dv, w += dw) { const k = find(u, v, w); if (k >= 0) between.push(k); }
            out.push({ to: j, between });
        });
        return out;
    });
    // rows[i]: the complete rows of five that block i belongs to
    const rows = blocks.map((b) => {
        const out = [];
        for (const axis of ['u', 'v', 'w']) {
            const from = axis === 'w' ? Math.floor(b.w / 5) * 5 : 0, line = [];
            for (let k = from; k < from + 5; k++) { const c = { ...b, [axis]: k }, j = find(c.u, c.v, c.w); if (j >= 0) line.push(j); }
            if (line.length === 5) out.push(line);
        }
        return out;
    });
    const windows = blocks.reduce((n, b) => n + b.faces.length, 0);
    const start = { [WHITE]: find(2, 4, low), [BLACK]: find(2, 0, low), [RED]: find(0, 2, low), [BLUE]: find(4, 2, low) };
    return { nPlayers, low, N, blocks, find, sight, rows, windows, need: Math.floor(windows / nPlayers) + 1, start };
}
const LAYOUTS = {};
export const layout = (nPlayers) => LAYOUTS[nPlayers] || (LAYOUTS[nPlayers] = makeLayout(nPlayers === 2 ? 2 : 4));

export function createState(nPlayers = 2) {
    const L = layout(nPlayers), grid = new Int8Array(L.N);
    for (const c of turnOrder(L.nPlayers)) grid[L.start[c]] = c;
    return { nPlayers: L.nPlayers, grid, turn: 0, ply: 0, done: 0 };
}
export function cloneState(s) {
    return { nPlayers: s.nPlayers, grid: s.grid.slice(), turn: s.turn, ply: s.ply, done: s.done };
}
export const currentColor = (s) => turnOrder(s.nPlayers)[s.turn];
// the elevator: the highest floor that can be lit. It starts one floor above the lowest and rises a floor every round.
export const elevator = (s) => Math.min(ROOF, layout(s.nPlayers).low + Math.floor(s.ply / s.nPlayers) + 1);

// lit windows per colour
export function scores(s) {
    const L = layout(s.nPlayers), n = [0, 0, 0, 0, 0];
    for (let i = 0; i < L.N; i++) if (s.grid[i]) n[s.grid[i]] += L.blocks[i].faces.length;
    return n;
}

// The blocks `color` may light: dark, no higher than the elevator, and in line with one of its own lit blocks
// with no rival's block between.
export function movesFor(s, color = currentColor(s)) {
    const L = layout(s.nPlayers), g = s.grid, top = elevator(s), out = [];
    for (let i = 0; i < L.N; i++) {
        if (g[i] || L.blocks[i].w > top) continue;
        for (const { to, between } of L.sight[i]) {
            if (g[to] !== color) continue;
            let clear = true;
            for (const k of between) if (g[k] && g[k] !== color) { clear = false; break; }
            if (clear) { out.push(i); break; }
        }
    }
    return out;
}

// Applies a move (the block to light) in place. Returns the list of things that happened, for the view.
export function applyMove(s, at, wantEvents = true) {
    const L = layout(s.nPlayers), g = s.grid, order = turnOrder(s.nPlayers), color = order[s.turn], ev = wantEvents ? [] : null;
    g[at] = color;
    ev && ev.push({ type: 'light', at, color });
    // every row of five completed by this block goes to whoever has most of it; ties stand as they are
    const taken = [];
    let mine = false;
    for (const line of L.rows[at]) {
        const n = [0, 0, 0, 0, 0];
        let full = true;
        for (const i of line) { if (!g[i]) { full = false; break; } n[g[i]]++; }
        if (!full) continue;
        let best = 0, tie = false;
        for (const c of order) { if (n[c] > n[best] || !best) { if (best && n[c] === n[best]) tie = true; else { best = c; tie = false; } } else if (n[c] === n[best]) tie = true; }
        if (tie) continue;
        taken.push({ line, color: best });
        if (best === color) mine = true;
    }
    if (taken.length) {
        const before = g.slice();
        for (const c of order) for (const t of taken) if (t.color === c) for (const i of t.line) g[i] = c;
        if (mine) g[at] = color; // the block that completed a row its owner won cannot be lost in the same move
        const changed = [];
        for (let i = 0; i < L.N; i++) if (g[i] !== before[i]) changed.push({ at: i, color: g[i], was: before[i] });
        ev && ev.push({ type: 'capture', rows: taken, changed });
    }
    s.ply++;
    // the next player who can light anything; if nobody can, or someone holds more than their share, it is over
    const sc = scores(s);
    if (order.some((c) => sc[c] >= L.need)) { s.done = 1; s.turn = (s.turn + 1) % s.nPlayers; return ev; }
    let k = 0;
    do { s.turn = (s.turn + 1) % s.nPlayers; k++; } while (k <= s.nPlayers && !movesFor(s).length);
    if (k > s.nPlayers) s.done = 1;
    else if (k > 1 && ev) ev.push({ type: 'skip', count: k - 1 });
    return ev;
}

// Returns null while the game runs, else { winner: colour | 0, reason }.
export function outcome(s) {
    if (!s.done) return null;
    const L = layout(s.nPlayers), sc = scores(s), order = turnOrder(s.nPlayers);
    let best = 0, tie = false;
    for (const c of order) { if (!best || sc[c] > sc[best]) { best = c; tie = false; } else if (sc[c] === sc[best]) tie = true; }
    return { winner: tie ? 0 : best, reason: sc[best] >= L.need ? 'share' : 'full' };
}

export function positionKey(s) {
    return s.turn + ':' + s.ply + ':' + Array.prototype.join.call(s.grid, '');
}
