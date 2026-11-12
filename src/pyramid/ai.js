// PYRAMID — computer opponents. Runs in a Web Worker (see ai-worker.js) or inline.
import {
    allMoves, applyMove, cloneState, outcome, turnOrder, heightAt, isVictoryCell,
    apexHeight, positionKey,
} from './rules.js';

const WIN = 100000;

// Score of the position for every colour, from that colour's own point of view.
function material(s) {
    const { B, grid } = s;
    const top = apexHeight(B) - 1;
    const sc = [0, 0, 0, 0, 0], n = [0, 0, 0, 0, 0];
    for (let i = 0; i < grid.length; i++) {
        const c = grid[i];
        if (!c) continue;
        n[c]++;
        const h = heightAt(B, Math.floor(i / B), i % B);
        let v = 100 + h * 14;
        if (h === top) v += 22;
        if (isVictoryCell(B, i)) v += 55;
        sc[c] += v;
    }
    for (let c = 1; c <= 4; c++) if (n[c] && n[c] < 4) sc[c] -= 260; // can no longer win
    return sc;
}

function evalFor(s, me, mode) {
    const o = outcome(s, mode);
    if (o) return o.winner === me ? WIN - s.ply : o.winner === 0 ? -200 : -WIN + s.ply;
    const sc = material(s);
    let worst = 0;
    for (const c of turnOrder(s.nPlayers)) if (c !== me) worst = Math.max(worst, sc[c]);
    return sc[me] - worst;
}

const ORDER = { smash: 5, pushfall: 5, pushdrop: 4, jump: 3, push: 2, run: 1 };

function ordered(s) {
    return allMoves(s).sort((a, b) => ORDER[b.type] - ORDER[a.type]);
}

// two players: alpha-beta
function alphabeta(s, depth, a, b, me, mode, ctx) {
    if (depth === 0 || outcome(s, mode)) return evalFor(s, me, mode);
    if ((++ctx.nodes & 1023) === 0 && performance.now() > ctx.deadline) { ctx.out = true; return 0; }
    const maxing = turnOrder(s.nPlayers)[s.turn] === me;
    let best = maxing ? -Infinity : Infinity;
    for (const m of ordered(s)) {
        const t = cloneState(s);
        applyMove(t, m, false);
        const v = alphabeta(t, depth - 1, a, b, me, mode, ctx);
        if (ctx.out) return 0;
        if (maxing) { if (v > best) best = v; if (best > a) a = best; }
        else { if (v < best) best = v; if (best < b) b = best; }
        if (a >= b) break;
    }
    return best === Infinity || best === -Infinity ? evalFor(s, me, mode) : best;
}

// three or four players: everyone maximises their own score
function maxn(s, depth, mode, ctx) {
    const order = turnOrder(s.nPlayers);
    if (depth === 0 || outcome(s, mode)) return order.map((c) => evalFor(s, c, mode));
    if ((++ctx.nodes & 1023) === 0 && performance.now() > ctx.deadline) { ctx.out = true; return null; }
    const idx = s.turn;
    let best = null;
    for (const m of ordered(s)) {
        const t = cloneState(s);
        applyMove(t, m, false);
        const v = maxn(t, depth - 1, mode, ctx);
        if (ctx.out) return null;
        if (!best || v[idx] > best[idx]) best = v;
    }
    return best || order.map((c) => evalFor(s, c, mode));
}

const LEVELS = {
    easy: { depth: 1, noise: 60, blunder: 0.22, ms: 150 },
    medium: { depth: 2, noise: 14, blunder: 0, ms: 400 },
    hard: { depth: 6, noise: 3, blunder: 0, ms: 1100 },
};

// history: position keys already seen in this game (to avoid shuffling back and forth)
export function chooseMove(state, level = 'medium', mode = 'standard', history = []) {
    const cfg = LEVELS[level] || LEVELS.medium;
    const s = cloneState(state);
    const me = turnOrder(s.nPlayers)[s.turn];
    const meIdx = s.turn;
    const moves = ordered(s);
    if (!moves.length) return null;
    if (Math.random() < cfg.blunder) return moves[Math.floor(Math.random() * moves.length)];
    const seen = new Set(history);
    const two = s.nPlayers === 2;
    const maxDepth = two ? cfg.depth : Math.min(cfg.depth, 3);
    const ctx = { nodes: 0, deadline: performance.now() + cfg.ms, out: false };
    let scored = null;
    for (let d = 1; d <= maxDepth; d++) {
        const cur = [];
        // search the previous iteration's best move first
        const list = scored ? scored.slice().sort((x, y) => y.v - x.v).map((x) => x.m) : moves;
        let alpha = -Infinity;
        for (const m of list) {
            const t = cloneState(s);
            applyMove(t, m, false);
            let v;
            if (two) {
                // a small window margin keeps near-equal moves comparable for the noise below
                v = alphabeta(t, d - 1, alpha - cfg.noise - 1, Infinity, me, mode, ctx);
            } else {
                const vec = maxn(t, d - 1, mode, ctx);
                v = vec ? vec[meIdx] : 0;
            }
            if (ctx.out) break;
            if (seen.has(positionKey(t))) v -= 45;
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
