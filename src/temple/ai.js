// TEMPLE — computer opponents. Runs in a Web Worker (see ai-worker.js) or inline.
import { allMoves, applyMove, cloneState, outcome, turnOrder, positionKey, layout } from './rules.js';

const WIN = 100000;

// Score of the position for every colour, from that colour's own point of view:
// stones, how far they have come, and how near the best runner is to the Artemis field.
function material(s) {
    const L = layout(s.nPlayers), g = s.grid, sc = [0, 0, 0, 0, 0], best = [0, 0, 0, 0, 0];
    const span = L.H - 1;
    for (let i = 0; i < g.length; i++) {
        const c = g[i];
        if (!c) continue;
        const p = L.progress[c][i];
        sc[c] += 100 + p * 5;
        // a runner counts only if it can still reach the tip: the hexagon and the arms narrow toward it
        const cell = L.cells[i], t = L.cells[L.target[c]];
        const side = c <= 2 ? Math.abs(cell.col - t.col) : Math.abs(cell.row - t.row);
        if (side <= span - p && p > best[c]) best[c] = p;
    }
    for (let c = 1; c <= 4; c++) sc[c] += best[c] * best[c] * 1.6;
    // the stone guarding your own tip is worth keeping there
    for (const c of turnOrder(s.nPlayers)) if (g[L.tip[c]] === c) sc[c] += 24;
    return sc;
}

function evalFor(s, me) {
    const o = outcome(s);
    if (o) return o.winner === me ? WIN - s.ply : o.winner === 0 ? -200 : -WIN + s.ply;
    const sc = material(s);
    let worst = 0;
    for (const c of turnOrder(s.nPlayers)) if (c !== me) worst = Math.max(worst, sc[c]);
    return sc[me] - worst;
}

const weight = (m) => m.steps.reduce((n, st) => n + (st.capture ? 4 : 0) + (st.type === 'leap' ? 1 : 0), 0);
function ordered(s) {
    return allMoves(s).sort((a, b) => weight(b) - weight(a));
}

// two players: alpha-beta
function alphabeta(s, depth, a, b, me, ctx) {
    if (depth === 0 || outcome(s)) return evalFor(s, me);
    if ((++ctx.nodes & 511) === 0 && performance.now() > ctx.deadline) { ctx.out = true; return 0; }
    const maxing = turnOrder(s.nPlayers)[s.turn] === me;
    let best = maxing ? -Infinity : Infinity;
    for (const m of ordered(s)) {
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

// four players: everyone maximises their own score
function maxn(s, depth, ctx) {
    const order = turnOrder(s.nPlayers);
    if (depth === 0 || outcome(s)) return order.map((c) => evalFor(s, c));
    if ((++ctx.nodes & 511) === 0 && performance.now() > ctx.deadline) { ctx.out = true; return null; }
    const idx = s.turn;
    let best = null;
    for (const m of ordered(s)) {
        const t = cloneState(s);
        applyMove(t, m, false);
        const v = maxn(t, depth - 1, ctx);
        if (ctx.out) return null;
        if (!best || v[idx] > best[idx]) best = v;
    }
    return best || order.map((c) => evalFor(s, c));
}

const LEVELS = {
    easy: { depth: 1, noise: 40, blunder: 0.2, ms: 150 },
    medium: { depth: 3, noise: 10, blunder: 0, ms: 450 },
    hard: { depth: 8, noise: 2, blunder: 0, ms: 1200 },
};

// history: position keys already seen in this game (to avoid shuffling back and forth)
export function chooseMove(state, level = 'medium', mode = 'standard', history = []) {
    const cfg = LEVELS[level] || LEVELS.medium;
    const s = cloneState(state);
    const me = turnOrder(s.nPlayers)[s.turn], meIdx = s.turn;
    const moves = ordered(s);
    if (!moves.length) return null;
    if (Math.random() < cfg.blunder) return moves[Math.floor(Math.random() * moves.length)];
    const seen = new Set(history);
    const two = s.nPlayers === 2;
    const maxDepth = two ? cfg.depth : Math.min(cfg.depth, 4);
    const ctx = { nodes: 0, deadline: performance.now() + cfg.ms, out: false };
    let scored = null;
    for (let d = 1; d <= maxDepth; d++) {
        const cur = [];
        const list = scored ? scored.slice().sort((x, y) => y.v - x.v).map((x) => x.m) : moves;
        let alpha = -Infinity;
        for (const m of list) {
            const t = cloneState(s);
            applyMove(t, m, false);
            let v;
            if (two) v = alphabeta(t, d - 1, alpha - cfg.noise - 1, Infinity, me, ctx);
            else { const vec = maxn(t, d - 1, ctx); v = vec ? vec[meIdx] : 0; }
            if (ctx.out) break;
            if (seen.has(positionKey(t))) v -= 60;
            if (v > alpha) alpha = v;
            cur.push({ m, v });
        }
        if (ctx.out) break;
        scored = cur;
        if (cur.some((x) => x.v > WIN / 2)) break; // forced win found
    }
    if (!scored) scored = moves.map((m) => ({ m, v: 0 }));
    let best = null;
    for (const x of scored) {
        const v = x.v + Math.random() * cfg.noise;
        if (!best || v > best.v) best = { m: x.m, v };
    }
    return best.m;
}
