// COLOSSUS — computer opponents. Runs in a Web Worker (see ai-worker.js) or inline.
import { allMoves, applyMove, cloneState, outcome, turnOrder, positionKey, layout, MIN_STONES } from './rules.js';

const WIN = 100000;

// Score of the position for every colour, from that colour's own point of view:
// stones first, then how much air their groups have left.
const seen = new Uint8Array(169), stack = new Int16Array(169), mark = new Uint16Array(169);
let stamp = 0;
function material(s) {
    const L = layout(s.nPlayers), g = s.grid, sc = [0, 0, 0, 0, 0], n = [0, 0, 0, 0, 0];
    seen.fill(0, 0, L.N);
    for (let i = 0; i < L.N; i++) {
        const c = g[i];
        if (!c || seen[i]) continue;
        let top = 0, size = 0, air = 0;
        stack[top++] = i; seen[i] = 1; stamp = (stamp + 1) & 0xffff || 1;
        while (top) {
            const at = stack[--top]; size++;
            for (let d = 0; d < 4; d++) {
                const j = L.nb[at * 4 + d];
                if (j < 0) continue;
                if (!g[j]) { if (mark[j] !== stamp) { mark[j] = stamp; air++; } }
                else if (g[j] === c && !seen[j]) { seen[j] = 1; stack[top++] = j; }
            }
        }
        n[c] += size;
        sc[c] += size * 100 - (air === 1 ? 26 + size * 16 : air === 2 ? 7 + size * 3 : 0) + Math.min(air, 6);
    }
    for (let c = 1; c <= 4; c++) if (n[c] && n[c] <= MIN_STONES + 1) sc[c] -= 45;
    return sc;
}

function evalFor(s, me) {
    const o = outcome(s);
    if (o) return o.winner === me ? WIN - s.ply : o.winner === 0 ? -200 : -WIN + s.ply;
    if (s.out[me]) return -WIN + s.ply;
    const sc = material(s);
    let worst = 0;
    for (const c of turnOrder(s.nPlayers)) if (c !== me && !s.out[c]) worst = Math.max(worst, sc[c]);
    return sc[me] - worst;
}

// Every reply is tried and scored at once; the best few are looked into further.
function search(s, depth, alpha, beta, me, ctx) {
    if ((++ctx.nodes & 31) === 0 && performance.now() > ctx.deadline) { ctx.out = true; return 0; }
    const maxing = turnOrder(s.nPlayers)[s.turn] === me;
    const kids = [];
    for (const m of allMoves(s)) {
        const t = cloneState(s);
        applyMove(t, m, false);
        kids.push({ t, e: evalFor(t, me) });
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
    easy: { depth: 1, noise: 35, blunder: 0.18, ms: 150, root: 0, width: 0 },
    medium: { depth: 2, noise: 10, blunder: 0, ms: 500, root: 24, width: 0 },
    hard: { depth: 4, noise: 2, blunder: 0, ms: 1300, root: 14, width: 7 },
};

// history: position keys already seen in this game (to avoid shuffling back and forth)
export function chooseMove(state, level = 'medium', mode = 'standard', history = []) {
    const cfg = LEVELS[level] || LEVELS.medium;
    const s = cloneState(state), me = turnOrder(s.nPlayers)[s.turn];
    const moves = allMoves(s);
    if (moves.length === 1) return moves[0];
    const past = new Set(history);
    let scored = moves.map((m) => {
        const t = cloneState(s);
        applyMove(t, m, false);
        const e = evalFor(t, me) + Math.random() * 2, rep = past.has(positionKey(t)) ? 40 : 0;
        return { m, t, v: e - rep, e, rep };
    }).sort((a, b) => b.v - a.v);
    if (Math.random() < cfg.blunder) return scored[Math.floor(Math.random() * Math.min(scored.length, 40))].m;
    if (scored[0].v < WIN / 2) {
        const ctx = { nodes: 0, deadline: performance.now() + cfg.ms, out: false, width: cfg.width };
        for (let d = 2; d <= cfg.depth; d += 2) { // always end on the rival's reply
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
