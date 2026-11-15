// CATHEDRAL — computer opponents. Runs in a Web Worker (see ai-worker.js) or inline.
import { allMoves, applyMove, cloneState, outcome, turnOrder, positionKey, countStones, reach, L, MIN_STONES } from './rules.js';

const WIN = 100000;

// Score of the position for every colour: its stones, how well they stand in lines (a line walks far), and a
// heavy price for a congregation that has lost its voice.
function material(s) {
    const g = s.grid, sc = [0, 0, 0, 0, 0], counts = countStones(s);
    for (let i = 0; i < g.length; i++) {
        const c = g[i];
        if (!c) continue;
        const cell = L.cells[i];
        sc[c] += 100 + Math.min(3, reach(g, i)) * 2 - (Math.abs(cell.x - 7) + Math.abs(cell.y - 7)) * 0.6;
    }
    for (let c = 1; c <= 4; c++) if (counts[c] && counts[c] < MIN_STONES) sc[c] -= 2000;
    return sc;
}

function evalFor(s, me) {
    const o = outcome(s);
    if (o) return o.winner === me ? WIN - s.ply : o.winner === 0 ? -200 : -WIN + s.ply;
    const sc = material(s);
    let worst = -Infinity, sum = 0, n = 0;
    for (const c of turnOrder(s.nPlayers)) if (c !== me) { worst = Math.max(worst, sc[c]); sum += sc[c]; n++; }
    return sc[me] - (s.nPlayers === 2 ? worst : worst * 0.6 + (sum / n) * 0.4);
}

const weight = (m) => m.steps.reduce((n, st) => n + (st.run ? st.run.length : 0), 0);
// the widest conversions first; of the endless plain walks only some are looked at deeper in the tree
function ordered(s, cap = 0) {
    const all = allMoves(s).sort((a, b) => weight(b) - weight(a));
    if (!cap || all.length <= cap) return all;
    const conv = all.filter((m) => m.steps[0].run), rest = all.filter((m) => !m.steps[0].run);
    const stride = Math.max(1, Math.floor(rest.length / Math.max(1, cap - conv.length)));
    return conv.slice(0, cap).concat(rest.filter((_, i) => i % stride === 0));
}

function alphabeta(s, depth, a, b, me, ctx) {
    if (depth === 0 || outcome(s)) return evalFor(s, me);
    if ((++ctx.nodes & 127) === 0 && performance.now() > ctx.deadline) { ctx.out = true; return 0; }
    const maxing = turnOrder(s.nPlayers)[s.turn] === me;
    let best = maxing ? -Infinity : Infinity;
    for (const m of ordered(s, ctx.cap)) {
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
    if ((++ctx.nodes & 127) === 0 && performance.now() > ctx.deadline) { ctx.out = true; return null; }
    const idx = s.turn;
    let best = null;
    for (const m of ordered(s, ctx.cap)) {
        const t = cloneState(s);
        applyMove(t, m, false);
        const v = maxn(t, depth - 1, ctx);
        if (ctx.out) return null;
        if (!best || v[idx] > best[idx]) best = v;
    }
    return best || order.map((c) => evalFor(s, c));
}

const LEVELS = {
    easy: { depth: 1, noise: 60, blunder: 0.2, ms: 150, cap: 0 },
    medium: { depth: 2, noise: 12, blunder: 0, ms: 500, cap: 40 },
    hard: { depth: 5, noise: 2, blunder: 0, ms: 1300, cap: 26 },
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
    const maxDepth = two ? cfg.depth : Math.min(cfg.depth, 3);
    const ctx = { nodes: 0, deadline: performance.now() + cfg.ms, out: false, cap: cfg.cap };
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
            if (seen.has(positionKey(t))) v -= 40;
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
