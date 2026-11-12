// SKYSCRAPER — computer opponents. Runs in a Web Worker (see ai-worker.js) or inline.
import { movesFor, applyMove, cloneState, outcome, turnOrder, scores, layout } from './rules.js';

const WIN = 100000;

function evalFor(s, me) {
    const o = outcome(s);
    if (o) return o.winner === me ? WIN - s.ply : o.winner === 0 ? -200 : -WIN + s.ply;
    const sc = scores(s), L = layout(s.nPlayers);
    let worst = 0;
    for (const c of turnOrder(s.nPlayers)) if (c !== me) worst = Math.max(worst, sc[c]);
    // rows nearly full count for whoever leads them: they are about to be taken
    let lead = 0;
    const g = s.grid, seen = new Set();
    for (let i = 0; i < L.N; i++) for (const line of L.rows[i]) {
        const key = line[0] * 1000 + line[4]; if (seen.has(key)) continue; seen.add(key);
        let mine = 0, theirs = 0, empty = 0;
        for (const k of line) { if (!g[k]) empty++; else if (g[k] === me) mine++; else theirs++; }
        if (empty === 1) lead += mine > theirs ? 2 : theirs > mine ? -2 : 0;
    }
    return (sc[me] - worst) * 10 + lead;
}

function alphabeta(s, depth, a, b, me, ctx) {
    if (depth === 0 || s.done) return evalFor(s, me);
    if ((++ctx.nodes & 255) === 0 && performance.now() > ctx.deadline) { ctx.out = true; return 0; }
    const maxing = turnOrder(s.nPlayers)[s.turn] === me;
    let best = maxing ? -Infinity : Infinity;
    for (const m of movesFor(s)) {
        const t = cloneState(s);
        applyMove(t, m, false);
        const v = alphabeta(t, depth - 1, a, b, me, ctx);
        if (ctx.out) return 0;
        if (maxing) { if (v > best) best = v; if (best > a) a = best; }
        else { if (v < best) best = v; if (best < b) b = best; }
        if (a >= b) break;
    }
    return best === Infinity || best === -Infinity ? evalFor(s, me) : best;
}

const LEVELS = {
    easy: { depth: 1, noise: 25, blunder: 0.2, ms: 150 },
    medium: { depth: 2, noise: 6, blunder: 0, ms: 450 },
    hard: { depth: 5, noise: 1, blunder: 0, ms: 1200 },
};

export function chooseMove(state, level = 'medium') {
    const cfg = LEVELS[level] || LEVELS.medium;
    const s = cloneState(state), me = turnOrder(s.nPlayers)[s.turn];
    const moves = movesFor(s);
    if (!moves.length) return null;
    if (Math.random() < cfg.blunder) return moves[Math.floor(Math.random() * moves.length)];
    const ctx = { nodes: 0, deadline: performance.now() + cfg.ms, out: false };
    const maxDepth = s.nPlayers === 2 ? cfg.depth : Math.min(cfg.depth, 3);
    let scored = null;
    for (let d = 1; d <= maxDepth; d++) {
        const cur = [];
        const list = scored ? scored.slice().sort((x, y) => y.v - x.v).map((x) => x.m) : moves;
        let alpha = -Infinity;
        for (const m of list) {
            const t = cloneState(s);
            applyMove(t, m, false);
            const v = alphabeta(t, d - 1, alpha - cfg.noise - 1, Infinity, me, ctx);
            if (ctx.out) break;
            if (v > alpha) alpha = v;
            cur.push({ m, v });
        }
        if (ctx.out) break;
        scored = cur;
        if (cur.some((x) => x.v > WIN / 2)) break;
    }
    if (!scored) scored = moves.map((m) => ({ m, v: 0 }));
    let best = null;
    for (const x of scored) {
        const v = x.v + Math.random() * cfg.noise;
        if (!best || v > best.v) best = { m: x.m, v };
    }
    return best.m;
}
