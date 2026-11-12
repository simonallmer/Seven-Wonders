// STATUE — computer opponents. Runs in a Web Worker (see ai-worker.js) or inline.
import { legalMoves, applyMove, cloneState, outcome, turnOrder, positionKey, layout, MIN_DICE } from './rules.js';

const WIN = 1000000;

// What a colour's dice are worth: every die counts, dice on the floor a little more than dice in
// reserve, and the nearer a player comes to the last four the more each one matters.
function side(s, c, L) {
    const g = s.grid, mid = (L.cols - 1) / 2, midR = (L.rows - 1) / 2;
    let n = s.reserve[c], v = s.reserve[c] * 100;
    for (let i = 0; i < g.length; i++) {
        if ((g[i] >> 3) !== c) continue;
        n++;
        const p = g[i] & 7, r = Math.floor(i / L.cols), col = i % L.cols;
        v += 112 + (p === 1 ? 7 : p <= 4 ? 3 : 0) - (Math.abs(r - midR) * (L.nPlayers === 2 ? 1 : 0.4) + Math.abs(col - mid)) * 1.2;
    }
    if (n < MIN_DICE) return -5000;
    return v + (n - MIN_DICE) * (n - MIN_DICE) * -1.5 + n * 30;
}

// How many rival dice `color` could take with its next stride: every die above 1 that one of its
// dice can walk to within its pips. With `mine` false it counts the dice of `color` that rivals could take.
const queue = new Int16Array(256), dist = new Int8Array(256);
function reach(s, L, color, mine) {
    const g = s.grid, hit = new Set();
    for (let i = 0; i < g.length; i++) {
        const v = g[i];
        if (!v || ((v >> 3) === color) !== mine) continue;
        const c = v >> 3, n = v & 7;
        dist.fill(-1, 0, g.length);
        let head = 0, tail = 0;
        queue[tail++] = i; dist[i] = 0;
        while (head < tail) {
            const at = queue[head++];
            if (dist[at] === n) continue;
            for (let d = 0; d < 4; d++) {
                const j = L.nb[at * 4 + d];
                if (j < 0 || dist[j] >= 0) continue;
                const w = g[j];
                if (w) {
                    if ((w >> 3) === c || (w & 7) === 1) continue;
                    if (mine || (w >> 3) === color) hit.add(j);
                }
                dist[j] = dist[at] + 1; queue[tail++] = j;
            }
        }
    }
    return hit.size;
}

function evaluate(s, me) {
    const o = outcome(s);
    if (o) return o.winner === me ? WIN - s.ply : o.winner === 0 ? -500 : -WIN + s.ply;
    const L = layout(s.nPlayers);
    let worst = -Infinity;
    for (const c of turnOrder(s.nPlayers)) if (c !== me && !s.out[c]) worst = Math.max(worst, side(s, c, L));
    let v = side(s, me, L) - worst;
    // a die that can be taken on the next move is as good as gone; a threat of one's own is worth less
    const can = reach(s, L, me, true), may = reach(s, L, me, false);
    if (turnOrder(s.nPlayers)[s.turn] === me) v += (can ? 70 : 0) + can * 8 - may * 16;
    else v -= (may ? 70 : 0) + may * 8 - can * 16;
    return v;
}

// Beam search: every reply is tried and scored at once, the best few are looked into further.
function search(s, depth, alpha, beta, me, ctx) {
    if ((++ctx.nodes & 31) === 0 && performance.now() > ctx.deadline) { ctx.out = true; return 0; }
    const maxing = turnOrder(s.nPlayers)[s.turn] === me;
    const kids = [];
    for (const m of legalMoves(s)) {
        const t = cloneState(s);
        applyMove(t, m, false);
        kids.push({ t, e: evaluate(t, me) });
    }
    kids.sort(maxing ? (a, b) => b.e - a.e : (a, b) => a.e - b.e);
    if (depth <= 1 || Math.abs(kids[0].e) > WIN / 2) return kids[0].e;
    let best = maxing ? -Infinity : Infinity;
    const n = Math.min(kids.length, ctx.width);
    for (let i = 0; i < n; i++) {
        const v = outcome(kids[i].t) ? kids[i].e : search(kids[i].t, depth - 1, alpha, beta, me, ctx);
        if (ctx.out) return 0;
        if (maxing) { if (v > best) best = v; if (best > alpha) alpha = best; }
        else { if (v < best) best = v; if (best < beta) beta = best; }
        if (alpha >= beta) break;
    }
    return best;
}

const LEVELS = {
    easy: { depth: 1, noise: 30, blunder: 0.15, ms: 150, root: 0, width: 0 },
    medium: { depth: 2, noise: 14, blunder: 0.04, ms: 500, root: 14, width: 0 },
    hard: { depth: 4, noise: 1, blunder: 0, ms: 1300, root: 12, width: 6 },
};

// history: position keys already seen in this game (to avoid shuffling back and forth)
export function chooseMove(state, level = 'medium', mode = 'standard', history = []) {
    const cfg = LEVELS[level] || LEVELS.medium;
    const s = cloneState(state), me = turnOrder(s.nPlayers)[s.turn];
    const moves = legalMoves(s);
    if (moves.length === 1) return moves[0];
    const seen = new Set(history);
    let scored = moves.map((m) => {
        const t = cloneState(s);
        applyMove(t, m, false);
        const e = evaluate(t, me) + Math.random() * 3, rep = seen.has(positionKey(t)) ? 40 : 0;
        return { m, t, v: e - rep, e, rep };
    }).sort((a, b) => b.v - a.v);
    if (Math.random() < cfg.blunder) return scored[Math.floor(Math.random() * Math.min(scored.length, 30))].m;
    if (scored[0].v < WIN / 2) {
        const ctx = { nodes: 0, deadline: performance.now() + cfg.ms, out: false, width: cfg.width };
        for (let d = 2; d <= cfg.depth; d += 2) { // always end on the rival's reply, so a grab that loses the die is seen
            // hard looks at every move once, then follows the best of them two moves further
            const n = Math.min(scored.length, d === 2 && cfg.depth > 2 ? 400 : cfg.root), cur = [];
            let alpha = -Infinity;
            for (let i = 0; i < n; i++) {
                const x = scored[i];
                const v = outcome(x.t) ? x.e : search(x.t, d - 1, alpha - cfg.noise - 1, Infinity, me, ctx) - x.rep;
                if (ctx.out) break;
                if (v > alpha) alpha = v;
                cur.push({ ...x, v });
            }
            if (ctx.out) break;
            const floor = Math.min(...cur.map((x) => x.v));
            scored = cur.concat(scored.slice(n).map((x) => ({ ...x, v: Math.min(x.v, floor) - 1 }))).sort((a, b) => b.v - a.v);
            if (scored[0].v > WIN / 2) break; // forced win found
        }
    }
    let best = null;
    for (const x of scored) {
        const v = x.v + Math.random() * cfg.noise;
        if (!best || v > best.v) best = { m: x.m, v };
    }
    return best.m;
}
