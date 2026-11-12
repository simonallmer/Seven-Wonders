// GARDENS — pure rules. Game design: Simon Allmer.
// No rendering, no DOM: this module is shared by the game, the AI worker and the tests.
//
// The board has two terraces, each a field of 3 × 5, divided by a wall, and four gardens:
//
//      White's High Garden ── upper field ── Black's High Garden
//               ▲ black stairs                    ▲ white stairs
//      White's Home Garden ── lower field ── Black's Home Garden
//
// A stone leaves its Home Garden, crosses the lower field into the rival's Home Garden, is carried
// up the staircase there, and crosses the upper field into its own High Garden. Seven stones win.
//
// Nodes: 0–14 lower field (row * 5 + col), 15–29 upper field, 30–33 the gardens.

export const WHITE = 1, BLACK = 2;
export const COLOR_NAMES = ['', 'White', 'Black'];
export const COLS = 5, ROWS = 3;
export const LOWER = 0, UPPER = 15, FIELDS = 30, NODES = 34;
export const G_WHITE_HIGH = 30, G_WHITE_HOME = 31, G_BLACK_HOME = 32, G_BLACK_HIGH = 33;
export const MAX_TOWER = 5, MAX_HAND = 5, WIN_COUNT = 7, START_STONES = 10;

export const isGarden = (n) => n >= FIELDS;
export const other = (c) => 3 - c;
export const homeOf = (c) => (c === WHITE ? G_WHITE_HOME : G_BLACK_HOME);
export const goalOf = (c) => (c === WHITE ? G_WHITE_HIGH : G_BLACK_HIGH);
// the staircases: [home garden, high garden above it, the colour it carries]
export const STAIRS = [[G_WHITE_HOME, G_WHITE_HIGH, BLACK], [G_BLACK_HOME, G_BLACK_HIGH, WHITE]];

export const NEIGHBOURS = (() => {
    const nb = Array.from({ length: NODES }, () => []);
    const link = (a, b) => { nb[a].push(b); nb[b].push(a); };
    for (const base of [LOWER, UPPER]) {
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            const i = base + r * COLS + c;
            if (c + 1 < COLS) link(i, i + 1);
            if (r + 1 < ROWS) link(i, i + COLS);
        }
        const left = base === LOWER ? G_WHITE_HOME : G_WHITE_HIGH, right = base === LOWER ? G_BLACK_HOME : G_BLACK_HIGH;
        for (let r = 0; r < ROWS; r++) { link(base + r * COLS, left); link(base + r * COLS + COLS - 1, right); }
    }
    return nb;
})();

export function turnOrder() { return [WHITE, BLACK]; }
export const currentColor = (s) => s.turn + 1;

// ---------------------------------------------------------------- towers
// A tower is one small integer: a leading 1 bit, then one bit per stone from the bottom up
// (0 white, 1 black). 1 is the empty field.
export const towerHeight = (v) => 31 - Math.clz32(v);
export const towerTop = (v) => (v === 1 ? 0 : ((v >> (towerHeight(v) - 1)) & 1) + 1);
export const towerPush = (v, c) => { const h = towerHeight(v); return (v & ~(1 << h)) | ((c - 1) << h) | (1 << (h + 1)); };
export function towerStones(v) {
    const out = [];
    for (let i = 0, h = towerHeight(v); i < h; i++) out.push(((v >> i) & 1) + 1);
    return out;
}
function towerFrom(stones) { let v = 1; for (const c of stones) v = towerPush(v, c); return v; }
const towerHas = (v, c) => { for (let i = 0, h = towerHeight(v); i < h; i++) if (((v >> i) & 1) + 1 === c) return true; return false; };
// the "lift": a player's stones are pulled to the top of the tower, the rest stay below in order
function towerLifted(v, c) {
    const st = towerStones(v);
    return towerFrom([...st.filter((x) => x !== c), ...st.filter((x) => x === c)]);
}

// ---------------------------------------------------------------- state

export function createState() {
    const towers = new Uint8Array(FIELDS).fill(1);
    const gardens = new Int8Array(8); // (garden - 30) * 2 + (colour - 1)
    gardens[(G_WHITE_HOME - FIELDS) * 2] = START_STONES;
    gardens[(G_BLACK_HOME - FIELDS) * 2 + 1] = START_STONES;
    return { nPlayers: 2, towers, gardens, turn: 0, ply: 0, passes: 0 };
}

export function cloneState(s) {
    return { nPlayers: 2, towers: s.towers.slice(), gardens: s.gardens.slice(), turn: s.turn, ply: s.ply, passes: s.passes };
}

export const gardenCount = (s, g, c) => s.gardens[(g - FIELDS) * 2 + c - 1];
export const goalCount = (s, c) => gardenCount(s, goalOf(c), c);

// ---------------------------------------------------------------- moves
// move = { type: 'move', from, count, path }
//          Take `count` stones from a garden (your own colour only) or a whole tower you control,
//          then walk: path[k] is the field where the k-th stone (lowest first) is set down. Staying
//          on a field sets down another stone there. Entering a garden sets down everything that
//          is left, so a garden is always the last entry of a path.
//        { type: 'lift', from }   no move left: pull your buried stones to the top of one tower
//        { type: 'pass' }         nothing at all can be done

const seen = new Uint8Array(NODES);

function walk(s, c, from, n, out) {
    const towers = s.towers, barred = goalOf(other(c)), path = [];
    const rec = (pos, k, hHere) => {
        if (k === n) { out.push({ type: 'move', from, count: n, path: path.slice() }); return; }
        if (k > 0 && hHere < MAX_TOWER) { path.push(pos); rec(pos, k + 1, hHere + 1); path.pop(); }
        for (const nb of NEIGHBOURS[pos]) {
            if (seen[nb]) continue; // never back onto a field already visited in this move
            if (nb >= FIELDS) {
                if (nb === barred) continue; // the rival's High Garden is reached by their staircase only
                path.push(nb); out.push({ type: 'move', from, count: n, path: path.slice() }); path.pop();
                continue;
            }
            const h = towerHeight(towers[nb]);
            if (h >= MAX_TOWER) continue; // a full tower closes its field
            seen[nb] = 1; path.push(nb);
            rec(nb, k + 1, h + 1);
            path.pop(); seen[nb] = 0;
        }
    };
    seen[from] = 1; rec(from, 0, 0); seen[from] = 0;
}

// what the player to move may pick up: [{ from, max }] — gardens offer 1..max stones, towers all of theirs
export function sources(s, c = currentColor(s)) {
    const out = [];
    for (let g = FIELDS; g < NODES; g++) {
        if (g === goalOf(c)) continue; // stones that reached the High Garden stay there
        const n = gardenCount(s, g, c);
        if (n) out.push({ from: g, max: Math.min(n, MAX_HAND) });
    }
    for (let i = 0; i < FIELDS; i++) if (towerTop(s.towers[i]) === c) out.push({ from: i, max: towerHeight(s.towers[i]) });
    return out;
}

// every complete move that starts by taking `count` stones from `from`
export function movesFrom(s, from, count, out = []) {
    walk(s, currentColor(s), from, count, out);
    return out;
}

export function legalMoves(s) {
    const c = currentColor(s), out = [];
    for (const src of sources(s, c)) {
        if (isGarden(src.from)) for (let k = 1; k <= src.max; k++) walk(s, c, src.from, k, out);
        else walk(s, c, src.from, src.max, out);
    }
    if (out.length) return out;
    for (let i = 0; i < FIELDS; i++) {
        const v = s.towers[i];
        if (towerHas(v, c) && towerLifted(v, c) !== v) out.push({ type: 'lift', from: i });
    }
    return out.length ? out : [{ type: 'pass' }];
}

// The position in the middle of a move, for the view: source emptied, `path` already set down.
// Returns { state, hand } where hand lists the stones still carried, lowest first.
export function partial(s, from, count, path) {
    const t = cloneState(s), c = currentColor(s);
    let hand;
    if (isGarden(from)) { t.gardens[(from - FIELDS) * 2 + c - 1] -= count; hand = new Array(count).fill(c); }
    else { hand = towerStones(t.towers[from]); t.towers[from] = 1; }
    for (const at of path) {
        if (isGarden(at)) { for (const x of hand) t.gardens[(at - FIELDS) * 2 + x - 1]++; hand = []; }
        else t.towers[at] = towerPush(t.towers[at], hand.shift());
    }
    return { state: t, hand };
}

// Applies a move in place. Returns the list of things that happened, for the view.
export function applyMove(s, m, wantEvents = true) {
    const c = currentColor(s), ev = wantEvents ? [] : null, g = s.gardens, tw = s.towers;
    if (m.type === 'move') {
        let hand;
        if (m.from >= FIELDS) { g[(m.from - FIELDS) * 2 + c - 1] -= m.count; hand = new Array(m.count).fill(c); }
        else { hand = towerStones(tw[m.from]); tw[m.from] = 1; }
        ev && ev.push({ type: 'pickup', from: m.from, stones: hand.slice() });
        let k = 0;
        for (const at of m.path) {
            if (at >= FIELDS) {
                ev && ev.push({ type: 'enter', at, stones: hand.slice(k) });
                for (; k < hand.length; k++) g[(at - FIELDS) * 2 + hand[k] - 1]++;
            } else {
                const v = tw[at], top = towerTop(v);
                tw[at] = towerPush(v, hand[k]);
                ev && ev.push({ type: 'drop', at, color: hand[k], slot: towerHeight(v), capture: hand[k] === c && top === other(c) });
                k++;
            }
        }
        s.passes = 0;
    } else if (m.type === 'lift') {
        ev && ev.push({ type: 'lift', at: m.from, color: c });
        tw[m.from] = towerLifted(tw[m.from], c);
        s.passes = 0;
    } else {
        ev && ev.push({ type: 'pass', color: c });
        s.passes++;
    }
    // between turns the staircases carry up whatever outnumbers the defenders of a Home Garden
    for (const [home, high, col] of STAIRS) {
        const a = (home - FIELDS) * 2, diff = g[a + col - 1] - g[a + 2 - col];
        if (diff > 0) {
            g[a + col - 1] -= diff; g[(high - FIELDS) * 2 + col - 1] += diff;
            ev && ev.push({ type: 'stairs', from: home, to: high, color: col, count: diff });
        }
    }
    s.ply++;
    s.turn ^= 1;
    return ev;
}

// Returns null while the game runs, else { winner: colour | 0, reason }.
export function outcome(s) {
    if (goalCount(s, WHITE) >= WIN_COUNT) return { winner: WHITE, reason: 'garden' };
    if (goalCount(s, BLACK) >= WIN_COUNT) return { winner: BLACK, reason: 'garden' };
    if (s.passes >= 2) return { winner: 0, reason: 'stuck' };
    return null;
}

export function positionKey(s) {
    return s.turn + ':' + Array.prototype.join.call(s.towers, '.') + ':' + Array.prototype.join.call(s.gardens, '.');
}

// sanity: every stone is somewhere (used by the tests)
export function countStones(s) {
    const n = [0, 0, 0];
    for (let i = 0; i < FIELDS; i++) for (const c of towerStones(s.towers[i])) n[c]++;
    for (let i = 0; i < 8; i++) n[(i & 1) + 1] += s.gardens[i];
    return n;
}
