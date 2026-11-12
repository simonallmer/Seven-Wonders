// GARDENS — computer opponents. Runs in a Web Worker (see ai-worker.js) or inline.
import {
    legalMoves, applyMove, cloneState, outcome, positionKey, towerHeight, towerTop,
    WHITE, FIELDS, UPPER, COLS, WIN_COUNT, G_WHITE_HIGH, G_WHITE_HOME, G_BLACK_HOME, G_BLACK_HIGH,
} from './rules.js';

const WIN = 1000000;

// How far along its journey every stone is. A stone is worth more the nearer it is to its High Garden;
// buried stones are worth little until someone frees them.
function side(s, c) {
    const g = s.gardens, white = c === WHITE;
    const at = (garden, col) => g[(garden - FIELDS) * 2 + col - 1];
    const home = white ? G_WHITE_HOME : G_BLACK_HOME, launch = white ? G_BLACK_HOME : G_WHITE_HOME;
    const arrive = white ? G_BLACK_HIGH : G_WHITE_HIGH, goal = white ? G_WHITE_HIGH : G_BLACK_HIGH;
    const inGoal = at(goal, c);
    let v = inGoal * 1000 + at(arrive, c) * 540 + at(launch, c) * 250 + at(home, c) * 60;
    if (inGoal >= WIN_COUNT - 1) v += 300;
    for (let i = 0; i < FIELDS; i++) {
        const t = s.towers[i];
        if (t === 1) continue;
        const h = towerHeight(t), mine = towerTop(t) === c, col = i % COLS, upper = i >= UPPER;
        // white walks the lower field left to right and the upper field right to left; black the other way
        const prog = upper === white ? COLS - 1 - col : col;
        for (let k = 0; k < h; k++) {
            if (((t >> k) & 1) + 1 !== c) continue;
            v += mine ? (upper ? 600 + prog * 34 : 105 + prog * 26) : (upper ? 150 : 45);
        }
        if (mine && h > 1) v += 6 * h; // a tall tower is hard to take and carries far
    }
    return v;
}

function evaluate(s, me) {
    const o = outcome(s);
    if (o) return o.winner === me ? WIN - s.ply : o.winner === 0 ? -500 : -WIN + s.ply;
    return side(s, me) - side(s, 3 - me);
}

// Beam search: every reply is tried and scored at once, the best few are looked into further.
function search(s, depth, alpha, beta, me, ctx) {
    if ((++ctx.nodes & 63) === 0 && performance.now() > ctx.deadline) { ctx.out = true; return 0; }
    const maxing = s.turn + 1 === me;
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
    easy: { depth: 1, noise: 150, blunder: 0.18, ms: 150, root: 0, width: 0 },
    medium: { depth: 2, noise: 30, blunder: 0, ms: 500, root: 60, width: 0 },
    hard: { depth: 5, noise: 6, blunder: 0, ms: 1300, root: 18, width: 7 },
};

// history: position keys already seen in this game (to avoid shuffling back and forth)
export function chooseMove(state, level = 'medium', mode = 'standard', history = []) {
    const cfg = LEVELS[level] || LEVELS.medium;
    const s = cloneState(state), me = s.turn + 1;
    const moves = legalMoves(s);
    if (moves.length === 1) return moves[0];
    const seen = new Set(history);
    let scored = moves.map((m) => {
        const t = cloneState(s);
        applyMove(t, m, false);
        const e = evaluate(t, me), rep = seen.has(positionKey(t)) ? 80 : 0;
        return { m, t, v: e - rep, e, rep };
    }).sort((a, b) => b.v - a.v);
    if (Math.random() < cfg.blunder) return scored[Math.floor(Math.random() * Math.min(scored.length, 40))].m;
    if (scored[0].v < WIN / 2) {
        const ctx = { nodes: 0, deadline: performance.now() + cfg.ms, out: false, width: cfg.width };
        for (let d = 2; d <= cfg.depth; d++) {
            // look deeper into the moves that still look best; the rest keep their last score, capped below them
            const n = Math.min(scored.length, cfg.root), cur = [];
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
