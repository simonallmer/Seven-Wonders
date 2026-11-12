// GREAT WALL — computer opponents. Runs in a Web Worker (see ai-worker.js) or inline.
import {
    applyMove, cloneState, outcome, turnOrder, positionKey, layout, supplyOf, moveTargets, arrow, spinKills, forces,
    DIRS, MIN_FORCE,
} from './rules.js';

const WIN = 1000000;

// the facing that looks from field a toward field b
function toward(L, a, b) {
    const dr = Math.sign(Math.floor(b / L.cols) - Math.floor(a / L.cols)), dc = Math.sign((b % L.cols) - (a % L.cols));
    const d = DIRS.findIndex(([r, c]) => r === dr && c === dc);
    return d < 0 ? 0 : d;
}
// facings worth trying for a warrior of `color` standing on `at`: at the nearest rivals, and down any open line to one
function facings(s, L, at, color, keep = -1) {
    const g = s.grid, out = new Set(), r0 = Math.floor(at / L.cols), c0 = at % L.cols, rivals = [];
    for (let i = 0; i < L.N; i++) if (g[i] && (g[i] >> 3) !== color) rivals.push([Math.max(Math.abs(Math.floor(i / L.cols) - r0), Math.abs((i % L.cols) - c0)), i]);
    rivals.sort((a, b) => a[0] - b[0]);
    for (const [, i] of rivals.slice(0, 2)) out.add(toward(L, at, i));
    for (let d = 0; d < 8; d++) { // a clear line of fire
        for (let r = r0 + DIRS[d][0], c = c0 + DIRS[d][1]; r >= 0 && c >= 0 && r < L.rows && c < L.cols && L.on[r * L.cols + c]; r += DIRS[d][0], c += DIRS[d][1]) {
            const v = g[r * L.cols + c];
            if (!v || r * L.cols + c === keep) continue;
            if ((v >> 3) !== color) out.add(d);
            break;
        }
    }
    if (!out.size) out.add(toward(L, at, L.supply[turnOrder(s.nPlayers).find((c) => c !== color && !s.out[c]) || color]));
    return [...out].slice(0, 3);
}

// The moves the computer weighs: every shot and spin, every placement and walk with a few sensible facings.
export function candidates(s) {
    const L = layout(s.nPlayers), g = s.grid, color = turnOrder(s.nPlayers)[s.turn], out = [];
    for (const to of supplyOf(s, color).fields) for (const f of facings(s, L, to, color)) out.push({ type: 'place', to, facing: f });
    for (let i = 0; i < L.N; i++) {
        if ((g[i] >> 3) !== color) continue;
        if (arrow(s, i).kills.length) out.push({ type: 'shoot', from: i });
        if (spinKills(s, i).length) for (const f of facings(s, L, i, color).slice(0, 2)) out.push({ type: 'spin', from: i, facing: f });
        for (const f of facings(s, L, i, color)) if (f !== (g[i] & 7)) out.push({ type: 'move', from: i, to: i, facing: f });
        for (const to of moveTargets(s, i)) for (const f of facings(s, L, to, color, i).slice(0, 2)) out.push({ type: 'move', from: i, to, facing: f });
    }
    if (!out.length) for (let i = 0; i < L.N; i++) if ((g[i] >> 3) === color) { out.push({ type: 'move', from: i, to: i, facing: ((g[i] & 7) + 1) & 7 }); break; }
    return out;
}

// What an army is worth: its warriors, a little more for those on the wall and near the fight, its supply line open.
function side(s, c, L, n) {
    const g = s.grid;
    let v = n[c] * 100, onWall = 0;
    const goal = L.supply[turnOrder(s.nPlayers).find((x) => x !== c && !s.out[x]) || c], gr = Math.floor(goal / L.cols), gc = goal % L.cols;
    for (let i = 0; i < L.N; i++) {
        if ((g[i] >> 3) !== c) continue;
        onWall++;
        v += 6 - Math.max(Math.abs(Math.floor(i / L.cols) - gr), Math.abs((i % L.cols) - gc)) * 0.5;
    }
    v += Math.min(onWall, 6) * 4;
    const root = g[L.supply[c]];
    if (root && (root >> 3) !== c && s.reserve[c] > 0) v -= 40 + s.reserve[c] * 6; // supply cut
    if (n[c] <= MIN_FORCE) v -= 40;
    return v;
}

function evalFor(s, me) {
    const o = outcome(s);
    if (o) return o.winner === me ? WIN - s.ply : o.winner === 0 ? -500 : -WIN + s.ply;
    if (s.out[me]) return -WIN + s.ply;
    const L = layout(s.nPlayers), n = forces(s);
    let worst = -Infinity;
    for (const c of turnOrder(s.nPlayers)) if (c !== me && !s.out[c]) worst = Math.max(worst, side(s, c, L, n));
    return side(s, me, L, n) - worst;
}

// Every reply is tried and scored at once; the best few are looked into further.
function search(s, depth, alpha, beta, me, ctx) {
    if ((++ctx.nodes & 15) === 0 && performance.now() > ctx.deadline) { ctx.out = true; return 0; }
    const maxing = turnOrder(s.nPlayers)[s.turn] === me;
    const kids = [];
    for (const m of candidates(s)) {
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
    easy: { depth: 1, noise: 30, blunder: 0.18, ms: 150, root: 0, width: 0 },
    medium: { depth: 2, noise: 8, blunder: 0, ms: 500, root: 30, width: 0 },
    hard: { depth: 4, noise: 2, blunder: 0, ms: 1300, root: 12, width: 6 },
};

// history: position keys already seen in this game (to avoid shuffling back and forth)
export function chooseMove(state, level = 'medium', mode = 'standard', history = []) {
    const cfg = LEVELS[level] || LEVELS.medium;
    const s = cloneState(state), me = turnOrder(s.nPlayers)[s.turn];
    const moves = candidates(s);
    if (!moves.length) return null;
    if (moves.length === 1) return moves[0];
    const past = new Set(history);
    let scored = moves.map((m) => {
        const t = cloneState(s);
        applyMove(t, m, false);
        const e = evalFor(t, me) + Math.random() * 2, rep = past.has(positionKey(t)) ? 30 : 0;
        return { m, t, v: e - rep, e, rep };
    }).sort((a, b) => b.v - a.v);
    if (Math.random() < cfg.blunder) return scored[Math.floor(Math.random() * Math.min(scored.length, 30))].m;
    if (scored[0].v < WIN / 2) {
        const ctx = { nodes: 0, deadline: performance.now() + cfg.ms, out: false, width: cfg.width };
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
