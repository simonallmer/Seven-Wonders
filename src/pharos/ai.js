// PHAROS — computer opponents. Runs in a Web Worker (see ai-worker.js) or inline.
import { allMoves, applyMove, cloneState, outcome, turnOrder, positionKey, layout, lightsFor, allied } from './rules.js';

const WIN = 100000;

// What a colour has: stones, beacons, and above all stones that can still be moved — a stone with light
// on it and somewhere to go. A side with few of those is close to standing still, which is losing.
function side(s, c, L) {
    const g = s.grid;
    let v = 0, live = 0, stones = 0;
    for (let i = 0; i < L.N; i++) {
        if (g[i] !== c) continue;
        stones++;
        let free = 0;
        for (let d = 0; d < 4; d++) { const j = L.nb[i * 4 + d]; if (j >= 0 && !(g[j] && allied(s, g[j], c))) free++; }
        const lights = lightsFor(s, i, c).length;
        if (free && lights) { live++; v += 6 + Math.min(lights, 3) * 3; }
    }
    for (let b = 0; b < 5; b++) if (s.lit[b] === c) v += b === 2 ? 34 : 22;
    v += stones * 100 + Math.min(live, 4) * 14;
    if (live <= 1) v -= 120;
    return v;
}

function evalFor(s, me) {
    const o = outcome(s);
    if (o) return o.winner === me ? WIN - s.ply : o.winner === 0 ? -200 : -WIN + s.ply;
    if (s.out[me]) return -WIN + s.ply;
    const L = layout(s.nPlayers);
    let worst = -Infinity;
    for (const c of turnOrder(s.nPlayers)) if (c !== me && !s.out[c]) worst = Math.max(worst, side(s, c, L));
    return side(s, me, L) - worst;
}

// Every reply is tried and scored at once; the best few are looked into further.
function search(s, depth, alpha, beta, me, ctx) {
    if ((++ctx.nodes & 15) === 0 && performance.now() > ctx.deadline) { ctx.out = true; return 0; }
    const maxing = turnOrder(s.nPlayers)[s.turn] === me;
    const kids = [];
    for (const m of allMoves(s, ctx.len)) {
        const t = cloneState(s);
        applyMove(t, m, false);
        kids.push({ t, e: evalFor(t, me) });
    }
    if (!kids.length) return evalFor(s, me);
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
    easy: { depth: 1, noise: 30, blunder: 0.18, ms: 150, root: 0, width: 0, len: 2 },
    medium: { depth: 2, noise: 9, blunder: 0, ms: 500, root: 24, width: 0, len: 3 },
    hard: { depth: 4, noise: 2, blunder: 0, ms: 1300, root: 12, width: 6, len: 4 },
};

// history: position keys already seen in this game (to avoid shuffling back and forth)
export function chooseMove(state, level = 'medium', mode = 'standard', history = []) {
    const cfg = LEVELS[level] || LEVELS.medium;
    const s = cloneState(state), me = turnOrder(s.nPlayers)[s.turn];
    const moves = allMoves(s, cfg.len);
    if (!moves.length) return null;
    if (moves.length === 1) return moves[0];
    const past = new Set(history);
    let scored = moves.map((m) => {
        const t = cloneState(s);
        applyMove(t, m, false);
        const e = evalFor(t, me) + Math.random() * 2, rep = past.has(positionKey(t)) ? 40 : 0;
        return { m, t, v: e - rep, e, rep };
    }).sort((a, b) => b.v - a.v);
    if (Math.random() < cfg.blunder) return scored[Math.floor(Math.random() * Math.min(scored.length, 30))].m;
    if (scored[0].v < WIN / 2) {
        const ctx = { nodes: 0, deadline: performance.now() + cfg.ms, out: false, width: cfg.width, len: Math.min(cfg.len, 3) };
        for (let d = 2; d <= cfg.depth; d += 2) { // always end on the rival's reply
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
