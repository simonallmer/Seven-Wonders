// PYRAMID — pure rules. Game design: Simon Allmer.
// No rendering, no DOM: this module is shared by the game, the AI worker and the tests.
//
// The board is a stepped pyramid seen from above: a B×B grid where every cell is one
// field and its step is its distance to the nearest edge (capped at the apex).
// 2 players: B = 7 (steps of 7, 5, 3 and the apex). 3–4 players: B = 9.

export const WHITE = 1, BLACK = 2, RED = 3, BLUE = 4;
export const COLOR_NAMES = ['', 'White', 'Black', 'Red', 'Blue'];
export const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function turnOrder(nPlayers) {
    return nPlayers === 2 ? [WHITE, BLACK] : [WHITE, RED, BLACK, BLUE];
}

export function createState(nPlayers = 2) {
    const B = nPlayers === 2 ? 7 : 9;
    const grid = new Int8Array(B * B);
    const lo = nPlayers === 2 ? 0 : 1, hi = lo + 7;
    for (let i = lo; i < hi; i++) {
        grid[(B - 1) * B + i] = WHITE;
        grid[i] = BLACK;
        if (nPlayers > 2) {
            grid[i * B] = RED;
            grid[i * B + B - 1] = BLUE;
        }
    }
    return { B, nPlayers, grid, turn: 0, lastPush: null, ply: 0 };
}

export function cloneState(s) {
    return { B: s.B, nPlayers: s.nPlayers, grid: s.grid.slice(), turn: s.turn, lastPush: s.lastPush, ply: s.ply };
}

export const currentColor = (s) => turnOrder(s.nPlayers)[s.turn];
export const apexHeight = (B) => (B - 1) / 2;

export function heightAt(B, r, c) {
    return Math.min(r, c, B - 1 - r, B - 1 - c);
}

export function victoryCells(B) {
    const m = (B - 1) / 2;
    return [(m - 1) * B + m - 1, (m - 1) * B + m + 1, (m + 1) * B + m - 1, (m + 1) * B + m + 1];
}

export function isVictoryCell(B, idx) {
    const m = (B - 1) / 2;
    return Math.abs(Math.floor(idx / B) - m) === 1 && Math.abs((idx % B) - m) === 1;
}

// All legal moves of the stone on `from`.
// move = { from, to, type, pushTo? }
//   run      slide to an empty field (level, or down over the edge)
//   smash    a run that drops onto an occupied lower field
//   jump     climb onto an empty adjacent field one step up
//   push     take the place of an adjacent stone on the same step; it moves one field on
//   pushdrop the pushed stone goes over the edge of its step (smashing whatever is below)
//   pushfall the pushed stone leaves the bottom step and is removed
export function movesFrom(s, from, out = []) {
    const { B, grid } = s;
    const r0 = Math.floor(from / B), c0 = from % B;
    const h0 = heightAt(B, r0, c0);
    for (const [dr, dc] of DIRS) {
        // RUN
        let r = r0, c = c0, h = h0;
        for (;;) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nc < 0 || nr >= B || nc >= B) break;
            const nh = heightAt(B, nr, nc);
            if (nh > h) break; // never upward
            const to = nr * B + nc;
            if (grid[to]) {
                if (nh < h) out.push({ from, to, type: 'smash' });
                break;
            }
            out.push({ from, to, type: 'run' });
            r = nr; c = nc; h = nh;
        }
        // JUMP / PUSH look at the adjacent field only
        const ar = r0 + dr, ac = c0 + dc;
        if (ar < 0 || ac < 0 || ar >= B || ac >= B) continue;
        const ah = heightAt(B, ar, ac);
        const adj = ar * B + ac;
        if (ah === h0 + 1) {
            if (!grid[adj]) out.push({ from, to: adj, type: 'jump' });
        } else if (ah === h0 && grid[adj]) {
            // a stone that was just pushed may not push straight back
            if (s.lastPush && s.lastPush.pushed === from && s.lastPush.pusher === adj) continue;
            const br = ar + dr, bc = ac + dc;
            if (br < 0 || bc < 0 || br >= B || bc >= B) {
                out.push({ from, to: adj, type: 'pushfall', pushTo: -1 });
                continue;
            }
            const bh = heightAt(B, br, bc);
            const behind = br * B + bc;
            if (bh === ah) {
                if (!grid[behind]) out.push({ from, to: adj, type: 'push', pushTo: behind });
            } else if (bh < ah) {
                out.push({ from, to: adj, type: 'pushdrop', pushTo: behind });
            }
        }
    }
    return out;
}

export function allMoves(s, color = currentColor(s)) {
    const out = [];
    const g = s.grid;
    for (let i = 0; i < g.length; i++) if (g[i] === color) movesFrom(s, i, out);
    return out;
}

// OSIRIS: stones enclosed in a straight, gap-free line on one step by two stones of one
// colour are removed. Every colour is checked at once on the same position, so two lines
// can take each other's flankers (a "Double Osiris").
export function findOsiris(s) {
    const { B, grid } = s;
    const captured = new Set(), attackers = new Set(), lines = [];
    const scan = (start, step) => {
        let i = 0;
        while (i < B - 2) {
            const a = start + i * step;
            const col = grid[a];
            if (!col) { i++; continue; }
            const h = heightAt(B, Math.floor(a / B), a % B);
            let j = i + 1;
            for (; j < B; j++) {
                const b = start + j * step;
                if (!grid[b] || heightAt(B, Math.floor(b / B), b % B) !== h) { j = -1; break; }
                if (grid[b] === col) break;
            }
            if (j > i + 1 && j < B) {
                for (let k = i + 1; k < j; k++) captured.add(start + k * step);
                attackers.add(a); attackers.add(start + j * step);
                lines.push({ a, b: start + j * step });
            }
            i++;
        }
    };
    for (let n = 0; n < B; n++) { scan(n * B, 1); scan(n, B); }
    return { captured: [...captured], attackers: [...attackers], lines };
}

// Applies a move in place. Returns the list of things that happened, for the view.
export function applyMove(s, m, wantEvents = true) {
    const g = s.grid;
    const ev = wantEvents ? [] : null;
    const color = g[m.from];
    s.lastPush = null;
    switch (m.type) {
        case 'run': case 'jump':
            g[m.to] = color; g[m.from] = 0;
            ev && ev.push({ type: 'move', from: m.from, to: m.to, style: m.type });
            break;
        case 'smash':
            ev && ev.push({ type: 'move', from: m.from, to: m.to, style: 'run', smash: { at: m.to, color: g[m.to] } });
            g[m.to] = color; g[m.from] = 0;
            break;
        case 'push': case 'pushdrop': {
            const pushed = g[m.to], below = g[m.pushTo];
            ev && ev.push({
                type: 'push', from: m.to, to: m.pushTo, drop: m.type === 'pushdrop',
                smash: below ? { at: m.pushTo, color: below } : null,
            });
            g[m.pushTo] = pushed; g[m.to] = color; g[m.from] = 0;
            ev && ev.push({ type: 'move', from: m.from, to: m.to, style: 'run' });
            s.lastPush = { pusher: m.to, pushed: m.pushTo };
            break;
        }
        case 'pushfall':
            ev && ev.push({ type: 'fall', from: m.to, dir: m.to - m.from, color: g[m.to] });
            g[m.to] = color; g[m.from] = 0;
            ev && ev.push({ type: 'move', from: m.from, to: m.to, style: 'run' });
            break;
    }
    const os = findOsiris(s);
    if (os.captured.length) {
        ev && ev.push({ type: 'osiris', captured: os.captured.map((i) => ({ at: i, color: g[i] })), attackers: os.attackers, lines: os.lines });
        for (const i of os.captured) g[i] = 0;
    }
    s.ply++;
    // next player who can actually move
    const n = s.nPlayers;
    let skipped = 0;
    do {
        s.turn = (s.turn + 1) % n;
        skipped++;
    } while (skipped <= n && !hasMove(s, turnOrder(n)[s.turn]));
    s.stuck = skipped > n;
    return ev;
}

function hasMove(s, color) {
    const g = s.grid, tmp = [];
    for (let i = 0; i < g.length; i++) {
        if (g[i] === color) { movesFrom(s, i, tmp); if (tmp.length) return true; }
    }
    return false;
}

export function countStones(s) {
    const n = [0, 0, 0, 0, 0];
    for (const v of s.grid) n[v]++;
    return n;
}

// mode 'standard': also won once every rival is below four stones.
// mode 'conquest': only the four victory fields win (the printed rulebook).
// Returns null while the game runs, else { winner: color | 0, reason }.
export function outcome(s, mode = 'standard') {
    const order = turnOrder(s.nPlayers);
    const vc = victoryCells(s.B);
    const first = s.grid[vc[0]];
    if (first && vc.every((i) => s.grid[i] === first)) return { winner: first, reason: 'summit' };
    const counts = countStones(s);
    const alive = order.filter((c) => counts[c] >= 4);
    if (alive.length === 0) return { winner: 0, reason: 'attrition' };
    if (mode === 'standard' && alive.length === 1) return { winner: alive[0], reason: 'attrition' };
    if (s.stuck) return { winner: 0, reason: 'stuck' };
    return null;
}

export function positionKey(s) {
    return s.turn + ':' + Array.prototype.join.call(s.grid, '');
}
