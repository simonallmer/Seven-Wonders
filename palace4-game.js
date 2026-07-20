// ============================================
// PALACE — "Twin Palaces"  (4-player carom / elimination)
// ============================================
// TWO Crystal Palaces, joined along their long side edge into one 16x10 board.
//   Palace A  = columns x 0..7     Palace B  = columns x 8..15
// Each palace keeps its OWN five 8x2 elevator bands (heights 1-3, start 1-2-3-2-1)
// worked from its own edge. Because the two are attached, the old lethal side
// edge between them is no longer a void — it is LIVE TERRAIN. Roll across the
// seam and the neighbour palace's band decides everything:
//   same level      keep rolling straight into the other palace
//   1 up            a step (hop only if staged) or a stop
//   2+ up           a WALL — you hit it and stop, you do NOT fall
//   1/2+ down       drop across and roll / hard-drop into the other palace
// Only the two OUTER long edges (x = 0 and x = 15) are still a sheer, lethal drop.
//
// FOUR seats around the ring, each with a home end and eight column-locked reserves:
//   White  A-south (y0, x0..7)      Red   B-south (y0, x8..15)
//   Black  A-north (y9, x0..7)      Blue  B-north (y9, x8..15)
// Turn order runs around the ring: White -> Red -> Blue -> Black.
//
// A band answers to any player standing a sphere on it — so an invader who rolls
// into the enemy palace can seize its elevators. Reduce a rival below four spheres
// (board + reserve) to knock them out; the last palace still standing wins.
// ============================================

const PAL_HALF = 8;                        // each palace is 8 wide
const PAL_W = 16;                          // two palaces, joined along x
const PAL_D = 10;
const PAL_BANDS = 5;
const PAL_TIER_START = [1, 2, 3, 2, 1];    // per palace, south to north
const PAL_TIER_MIN = 1;
const PAL_TIER_MAX = 3;
const PAL_STONES = 8;                      // one reserve per column, locked to its entry pane
const PAL_LOSE_BELOW = 4;                  // a seat is out when total (board + reserve) drops below this

// seats & geometry ------------------------------------------------------------
const PAL_PLAYERS = ['W', 'R', 'U', 'B'];  // turn order, clockwise around the ring
const PAL_SEAT = {
    W: { name: 'White', palace: 'A', end: 'S' },
    R: { name: 'Red', palace: 'B', end: 'S' },
    U: { name: 'Blue', palace: 'B', end: 'N' },
    B: { name: 'Black', palace: 'A', end: 'N' }
};

function palPalaceOf(x) { return x < PAL_HALF ? 'A' : 'B'; }
function palPalaceX0(p) { return p === 'A' ? 0 : PAL_HALF; }         // west column of a palace
function palBand(y) { return Math.floor(y / 2); }
function palBandHeight(palace, b) { return palTierHeights[palace][b]; }
function palIsApex() { return false; }     // no crown — safe stub for the 3D view
function palLevel(x, y) { return palTierHeights[palPalaceOf(x)][palBand(y)]; }
function palInBounds(x, y) { return x >= 0 && x < PAL_W && y >= 0 && y < PAL_D; }
function palEntranceRow(color) { return PAL_SEAT[color].end === 'S' ? 0 : PAL_D - 1; }
function palSeatCols(color) { const x0 = palPalaceX0(PAL_SEAT[color].palace); return [x0, x0 + PAL_HALF - 1]; }
function palColOffset(color, x) { return x - palPalaceX0(PAL_SEAT[color].palace); }   // 0..7
function palColToX(color, off) { return palPalaceX0(PAL_SEAT[color].palace) + off; }

const PAL_DIRS = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

// ---- state ----
let palPlay = [];                 // spheres on the buildings
let palTurn = 'W';
let palSel = null;                // {kind:'stone', id} | {kind:'pool'} | null
let palWinner = null;
let palWinReason = null;          // 'smash' | 'stuck'
let palLastPush = null;           // {id, back:{x,y}} — no immediate push-back
let palNextId = 1;
let palPool = { W: palFullReserve(), R: palFullReserve(), U: palFullReserve(), B: palFullReserve() };
let palTierHeights = { A: PAL_TIER_START.slice(), B: PAL_TIER_START.slice() };
let palAlive = { W: true, R: true, U: true, B: true };
let palFreeMode = false;          // sandbox: ignore turns, move any sphere
let palAISet = { W: false, R: true, U: true, B: true };   // human is White; rest computer by default
let palAIBusy = false;
let palAIActing = false;

function palStoneAt(x, y) { return palPlay.find(function (s) { return s.x === x && s.y === y; }) || null; }
function palBoardCount(c) { return palPlay.filter(function (s) { return s.color === c; }).length; }
function palFullReserve() { const a = []; for (let x = 0; x < PAL_HALF; x++) a.push(true); return a; }
function palPoolCount(c) { return palPool[c].filter(Boolean).length; }
function palTotal(c) { return palPoolCount(c) + palBoardCount(c); }
function palAliveList() { return PAL_PLAYERS.filter(function (c) { return palAlive[c]; }); }

function palClear() { palStartPlay(); }
function palSetFree(on) { palFreeMode = !!on; palSel = null; refreshPal(); }

function palStartPlay() {
    palPlay = []; palNextId = 1; palWinner = null; palWinReason = null; palLastPush = null;
    palPool = { W: palFullReserve(), R: palFullReserve(), U: palFullReserve(), B: palFullReserve() };
    palTierHeights = { A: PAL_TIER_START.slice(), B: PAL_TIER_START.slice() };
    palAlive = { W: true, R: true, U: true, B: true };
    palTurn = 'W'; palSel = null;
    const box = document.getElementById('message-box');
    if (box) box.classList.remove('visible');
    refreshPal();
    if (palIsAITurn()) palAIKick();
}

// ---- LEVEL CONTROL ----
// A band is identified by its palace ('A'|'B') and index (0..4).
function palSetTier(palace, band, delta) {
    if (palWinner) return;
    if (palIsAITurn() && !palAIActing) return;   // humans can't work levels on a computer's turn
    if (band < 0 || band >= PAL_BANDS) return;
    const next = palTierHeights[palace][band] + delta;
    if (next < PAL_TIER_MIN || next > PAL_TIER_MAX) return;

    // A band only answers to a player standing a sphere on it, and working the
    // control spends the turn. Free Move lifts both restrictions.
    if (!palFreeMode) {
        const owns = palPlay.some(function (s) {
            return s.color === palTurn && palPalaceOf(s.x) === palace && palBand(s.y) === band;
        });
        if (!owns) { flashPal('You need a sphere on that band to work its level'); return; }
    }

    palTierHeights[palace][band] = next;
    palPlay.forEach(function (s) { s.k = palLevel(s.x, s.y); });   // spheres ride the band
    palSel = null;
    palLastPush = null;
    palResolveHadesAnimated(palTurn);                             // a raised wall can Hades a group

    if (palFreeMode) { refreshPal(); return; }
    palAfterMove();
}

// ---- targets ----
// Resolve one committed roll of sphere `s` in direction `d`. Identical terrain
// logic to the single-palace game — the seam between the two palaces is just
// more terrain now, since palInBounds spans the whole 16-wide board and palLevel
// returns the neighbour palace's height. Only the two OUTER x edges are lethal.
function palRollInDir(s, d) {
    const moves = [];
    const kills = [];
    let cx = s.x, cy = s.y, lv = palLevel(cx, cy);
    let firstStep = true, didHop = false, sFell = false, pushBack = null;

    function stopBefore() { if (cx !== s.x || cy !== s.y) moves.push({ id: s.id, x: cx, y: cy }); }

    while (true) {
        const nx = cx + d.dx, ny = cy + d.dy;

        if (!palInBounds(nx, ny)) {                            // reached an edge
            if (nx < 0 || nx >= PAL_W) {                       // OUTER side edge — sheer lethal drop
                kills.push({ id: s.id, mode: 'fall', x: cx, y: cy, k: lv, dx: d.dx, dy: d.dy });
                sFell = true;
            } else {
                stopBefore();                                  // pool-side lip — rest on the last pane
            }
            break;
        }

        const nlv = palLevel(nx, ny);
        const occ = palStoneAt(nx, ny);

        if (nlv === lv) {
            if (occ) {                                        // CAROM — shove it one pane along
                const px = nx + d.dx, py = ny + d.dy;
                if (px < 0 || px >= PAL_W) {                  // shoved over an outer side edge — it dies
                    kills.push({ id: occ.id, mode: 'fall', x: nx, y: ny, k: nlv, dx: d.dx, dy: d.dy });
                    moves.push({ id: s.id, x: nx, y: ny });   // striker takes the vacated pane
                } else if (!palInBounds(px, py)) {            // shoved against the pool-side lip — it holds
                    stopBefore();
                } else if (palLevel(px, py) === nlv && !palStoneAt(px, py)) {
                    if (palLastPush && occ.id === palLastPush.id && px === palLastPush.back.x && py === palLastPush.back.y) {
                        stopBefore();                         // no immediate push-back
                    } else {
                        moves.push({ id: occ.id, x: px, y: py });
                        moves.push({ id: s.id, x: nx, y: ny });
                        pushBack = { id: occ.id, back: { x: nx, y: ny } };
                    }
                } else {
                    stopBefore();                             // backed by a step/wall/sphere — immovable
                }
                break;
            }
            cx = nx; cy = ny; firstStep = false; continue;    // flat — keep rolling
        }

        if (nlv === lv + 1) {                                 // up-step: only a staged first-move hop climbs
            if (firstStep && !occ) { moves.push({ id: s.id, x: nx, y: ny }); didHop = true; }
            else stopBefore();
            break;
        }
        if (nlv >= lv + 2) { stopBefore(); break; }           // wall (even across the seam)

        if (nlv === lv - 1) {
            if (occ) {                                        // drop one onto a sphere — smash
                kills.push({ id: occ.id, mode: 'smash', x: nx, y: ny, k: nlv });
                moves.push({ id: s.id, x: nx, y: ny });
                break;
            }
            cx = nx; cy = ny; lv = nlv; firstStep = false; continue;   // drop one, keep rolling
        }

        // nlv <= lv - 2 : hard drop and stay (smashing anything underneath)
        if (occ) kills.push({ id: occ.id, mode: 'smash', x: nx, y: ny, k: nlv });
        moves.push({ id: s.id, x: nx, y: ny });
        break;
    }

    if (!moves.length && !kills.length) return null;

    const sMove = moves.find(function (m) { return m.id === s.id; });
    let type = 'roll';
    if (didHop) type = 'hop';
    else if (sFell) type = 'fall';
    else if (kills.some(function (k) { return k.mode === 'smash'; })) type = 'smash';
    else if (kills.length) type = 'carom';

    let render;
    if (sMove) render = { x: sMove.x, y: sMove.y };
    else if (sFell) { const kf = kills.find(function (k) { return k.id === s.id; }); render = { x: kf.x, y: kf.y }; }
    else if (kills.length) render = { x: kills[0].x, y: kills[0].y };
    else render = { x: s.x, y: s.y };

    return { type: type, render: render, moves: moves, kills: kills, pushBack: pushBack };
}

function palStoneTargets(s) {
    const out = [];
    PAL_DIRS.forEach(function (d) {
        const r = palRollInDir(s, d);
        if (r) out.push({ dx: d.dx, dy: d.dy, x: r.render.x, y: r.render.y, type: r.type });
    });
    return out;
}

function palPlaceTargets(color) {
    const out = [];
    const y = palEntranceRow(color);
    const cols = palSeatCols(color);
    for (let x = cols[0]; x <= cols[1]; x++) {
        if (!palPool[color][palColOffset(color, x)]) continue;   // that reserve is already deployed
        if (palStoneAt(x, y)) continue;
        if (palLevel(x, y) !== 1) continue;                      // enter only where your band is at ground height
        out.push({ x: x, y: y, type: 'place' });
    }
    return out;
}

function palLegalForSelected() {
    if (!palSel) return [];
    if (palSel.kind === 'pool') return palPlaceTargets(palTurn);
    const s = palPlay.find(function (p) { return p.id === palSel.id; });
    return s ? palStoneTargets(s) : [];
}

function palHasAnyAction(color) {
    if (palPoolCount(color) > 0 && palPlaceTargets(color).length) return true;
    if (palPlay.some(function (s) { return s.color === color && palStoneTargets(s).length; })) return true;
    // working a level control is also an action: any band this colour stands on that can still move.
    for (let bi = 0; bi < PAL_BANDS; bi++) {
        for (let pi = 0; pi < 2; pi++) {
            const palace = pi === 0 ? 'A' : 'B';
            const h = palTierHeights[palace][bi];
            if ((h < PAL_TIER_MAX || h > PAL_TIER_MIN) &&
                palPlay.some(function (s) { return s.color === color && palPalaceOf(s.x) === palace && palBand(s.y) === bi; })) return true;
        }
    }
    return false;
}

// ---- interaction ----
function palPlayTapStone(id) {
    if (palWinner || palIsAITurn()) return;
    const s = palPlay.find(function (p) { return p.id === id; });
    if (!s) return;
    if (palFreeMode) palTurn = s.color;
    if (s.color !== palTurn) { flashPal(PAL_SEAT[palTurn].name + ' to move'); return; }
    palSel = (palSel && palSel.kind === 'stone' && palSel.id === id) ? null : { kind: 'stone', id: id };
    refreshPal();
}

function palTapPool(color) {
    if (palWinner || palIsAITurn()) return;
    if (palFreeMode) palTurn = color;
    if (color !== palTurn) { flashPal(PAL_SEAT[palTurn].name + ' to move'); return; }
    if (palPoolCount(color) <= 0) { flashPal('Pool is empty'); return; }
    const same = palSel && palSel.kind === 'pool';
    palSel = same ? null : { kind: 'pool' };
    refreshPal();
}

function palPlayTapTarget(t) {
    if (palWinner || !palSel || palIsAITurn()) return;

    if (t.type === 'place') {
        const legal = palPlaceTargets(palTurn).some(function (q) { return q.x === t.x && q.y === t.y; });
        if (!legal) return;
        palPool[palTurn][palColOffset(palTurn, t.x)] = false;
        palPlay.push({ id: palNextId++, color: palTurn, x: t.x, y: t.y, k: palLevel(t.x, t.y) });
        if (window.palaceSync3D) window.palaceSync3D();
        if (window.palaceAnimPlace) window.palaceAnimPlace(palNextId - 1, t.x, t.y);
        palLastPush = null;
        palResolveHadesAnimated(palTurn);
        palAfterMove();
        return;
    }

    const s = palPlay.find(function (p) { return p.id === palSel.id; });
    if (!s) return;
    const legal = palStoneTargets(s).some(function (q) { return q.dx === t.dx && q.dy === t.dy; });
    if (!legal) return;

    const r = palRollInDir(s, { dx: t.dx, dy: t.dy });
    if (!r) return;
    palApplyRoll(r);
    palLastPush = r.pushBack || null;
    palResolveHadesAnimated(palTurn);
    palAfterMove();
}

function palApplyRoll(r) {
    const from = {};
    palPlay.forEach(function (p) { from[p.id] = { x: p.x, y: p.y, k: p.k }; });

    r.kills.forEach(function (k) {
        const idx = palPlay.findIndex(function (p) { return p.id === k.id; });
        if (idx >= 0) palPlay.splice(idx, 1);
    });
    r.moves.forEach(function (m) {
        const p = palPlay.find(function (q) { return q.id === m.id; });
        if (p) { p.x = m.x; p.y = m.y; p.k = palLevel(m.x, m.y); }
    });

    r.kills.forEach(function (k) {
        if (k.mode === 'smash' && window.palaceAnimSmash) window.palaceAnimSmash(k.id, k.x, k.y, k.k);
        else if (k.mode === 'fall' && window.palaceAnimFallOff) window.palaceAnimFallOff(k.id, { x: k.x, y: k.y, k: k.k }, k.dx, k.dy);
    });
    r.moves.forEach(function (m) {
        const f = from[m.id];
        if (f && window.palaceAnimStoneMove) window.palaceAnimStoneMove(m.id, f, { x: m.x, y: m.y, k: palLevel(m.x, m.y) }, 'roll');
    });
}

// ---- HADES (surround capture) ----
function palDeadGroupIds(color) {
    const seen = {};
    const dead = [];
    palPlay.forEach(function (start) {
        if (start.color !== color || seen[start.id]) return;
        const group = [], stack = [start]; seen[start.id] = true;
        let hasLiberty = false;
        while (stack.length) {
            const s = stack.pop(); group.push(s);
            const slv = palLevel(s.x, s.y);
            for (let i = 0; i < PAL_DIRS.length; i++) {
                const d = PAL_DIRS[i], nx = s.x + d.dx, ny = s.y + d.dy;
                if (!palInBounds(nx, ny)) continue;               // board edge — seals
                const occ = palStoneAt(nx, ny);
                if (occ) {
                    if (occ.color === color && !seen[occ.id]) { seen[occ.id] = true; stack.push(occ); }
                    continue;                                     // enemy / counted friend — no liberty here
                }
                if (palLevel(nx, ny) < slv + 2) hasLiberty = true;  // empty & reachable (2+ wall seals)
            }
        }
        if (!hasLiberty) group.forEach(function (s) { dead.push(s.id); });
    });
    return dead;
}

// Opponents' suffocated groups fall first, then the mover's own (self-surround).
function palResolveHades(mover) {
    const removed = [];
    const order = PAL_PLAYERS.filter(function (c) { return c !== mover; }).concat([mover]);
    order.forEach(function (color) {
        palDeadGroupIds(color).forEach(function (id) {
            const idx = palPlay.findIndex(function (p) { return p.id === id; });
            if (idx >= 0) { const s = palPlay[idx]; removed.push({ id: s.id, x: s.x, y: s.y, k: s.k }); palPlay.splice(idx, 1); }
        });
    });
    return removed;
}
function palResolveHadesAnimated(mover) {
    palResolveHades(mover).forEach(function (rm) {
        if (window.palaceAnimSmash) window.palaceAnimSmash(rm.id, rm.x, rm.y, rm.k);
    });
}

// ---- elimination & win ----
// Any seat whose total falls below the threshold is knocked out; last one standing wins.
function palUpdateElimination() {
    PAL_PLAYERS.forEach(function (c) {
        if (palAlive[c] && palTotal(c) < PAL_LOSE_BELOW) palAlive[c] = false;
    });
    const living = palAliveList();
    if (living.length <= 1) { palWinner = living[0] || null; palWinReason = 'smash'; }
}

function palNextAlive(from) {
    const i = PAL_PLAYERS.indexOf(from);
    for (let s = 1; s <= PAL_PLAYERS.length; s++) {
        const c = PAL_PLAYERS[(i + s) % PAL_PLAYERS.length];
        if (palAlive[c]) return c;
    }
    return from;
}

function palAfterMove() {
    palSel = null;
    palUpdateElimination();
    if (palWinner) { refreshPal(); if (window.palaceWin) window.palaceWin(palWinner); return; }
    if (palFreeMode) { refreshPal(); return; }

    // advance to the next living seat that actually has a move; a stuck seat is skipped.
    let next = palNextAlive(palTurn);
    let guard = 0;
    while (!palHasAnyAction(next) && guard < PAL_PLAYERS.length) { next = palNextAlive(next); guard++; }
    palTurn = next;
    if (!palHasAnyAction(palTurn)) {                 // nobody can move — settle on material
        const living = palAliveList();
        living.sort(function (a, b) { return palTotal(b) - palTotal(a); });
        palWinner = living[0] || null; palWinReason = 'stuck';
        refreshPal();
        if (window.palaceWin) window.palaceWin(palWinner);
        return;
    }
    refreshPal();
    if (palIsAITurn()) palAIKick();
}

// ============================================
// COMPUTER OPPONENTS
// ============================================
function palIsAITurn() { return !palFreeMode && !palWinner && !!palAISet[palTurn]; }

function palSetAI(allComputer) {
    // toggle every non-White seat between computer and human
    palAISet = { W: false, R: !!allComputer, U: !!allComputer, B: !!allComputer };
    palAIBusy = false;
    refreshPal();
    if (palIsAITurn()) palAIKick();
}

function palAIKick() {
    if (palAIBusy || !palIsAITurn()) return;
    palAIBusy = true;
    setTimeout(function () { palAIBusy = false; palAIMove(); }, 560);
}

function palGenMoves(color) {
    const out = [];
    palPlaceTargets(color).forEach(function (t) { out.push({ kind: 'place', x: t.x, y: t.y }); });
    palPlay.forEach(function (s) {
        if (s.color !== color) return;
        palStoneTargets(s).forEach(function (t) { out.push({ kind: 'roll', id: s.id, dx: t.dx, dy: t.dy }); });
    });
    ['A', 'B'].forEach(function (palace) {
        for (let b = 0; b < PAL_BANDS; b++) {
            if (!palPlay.some(function (s) { return s.color === color && palPalaceOf(s.x) === palace && palBand(s.y) === b; })) continue;
            if (palTierHeights[palace][b] < PAL_TIER_MAX) out.push({ kind: 'tier', palace: palace, band: b, delta: 1 });
            if (palTierHeights[palace][b] > PAL_TIER_MIN) out.push({ kind: 'tier', palace: palace, band: b, delta: -1 });
        }
    });
    return out;
}

function palSnapshot() {
    return {
        play: palPlay.map(function (p) { return { id: p.id, color: p.color, x: p.x, y: p.y, k: p.k }; }),
        tiers: { A: palTierHeights.A.slice(), B: palTierHeights.B.slice() },
        pool: { W: palPool.W.slice(), R: palPool.R.slice(), U: palPool.U.slice(), B: palPool.B.slice() },
        turn: palTurn, nextId: palNextId
    };
}
function palRestore(s) {
    palPlay = s.play.map(function (p) { return { id: p.id, color: p.color, x: p.x, y: p.y, k: p.k }; });
    palTierHeights = { A: s.tiers.A.slice(), B: s.tiers.B.slice() };
    palPool = { W: s.pool.W.slice(), R: s.pool.R.slice(), U: s.pool.U.slice(), B: s.pool.B.slice() };
    palTurn = s.turn; palNextId = s.nextId;
}
function palSimApply(m, color) {
    if (m.kind === 'place') {
        palPool[color][palColOffset(color, m.x)] = false;
        palPlay.push({ id: palNextId++, color: color, x: m.x, y: m.y, k: palLevel(m.x, m.y) });
    } else if (m.kind === 'tier') {
        palTierHeights[m.palace][m.band] += m.delta;
        palPlay.forEach(function (s) { s.k = palLevel(s.x, s.y); });
    } else {
        const s = palPlay.find(function (p) { return p.id === m.id; });
        if (s) {
            const r = palRollInDir(s, { dx: m.dx, dy: m.dy });
            if (r) {
                r.kills.forEach(function (k) { const i = palPlay.findIndex(function (p) { return p.id === k.id; }); if (i >= 0) palPlay.splice(i, 1); });
                r.moves.forEach(function (mv) { const p = palPlay.find(function (q) { return q.id === mv.id; }); if (p) { p.x = mv.x; p.y = mv.y; p.k = palLevel(mv.x, mv.y); } });
            }
        }
    }
    palResolveHades(color);
}

function palMaxOther(color) {
    let best = 0;
    PAL_PLAYERS.forEach(function (c) { if (c !== color && palAlive[c]) best = Math.max(best, palTotal(c)); });
    return best;
}
// net spheres a move removes from rivals, minus own losses — full sim (roll-kills,
// carom-off-the-rim and Hades surrounds all counted).
function palMoveSwing(m, color) {
    const snap = palSnapshot();
    let oppBefore = 0; PAL_PLAYERS.forEach(function (c) { if (c !== color) oppBefore += palTotal(c); });
    const ownBefore = palTotal(color);
    palSimApply(m, color);
    let oppAfter = 0; PAL_PLAYERS.forEach(function (c) { if (c !== color) oppAfter += palTotal(c); });
    const swing = (oppBefore - oppAfter) - (ownBefore - palTotal(color));
    palRestore(snap);
    return swing;
}
function palBestSwing(color) {
    let best = 0;
    palGenMoves(color).forEach(function (m) { const sw = palMoveSwing(m, color); if (sw > best) best = sw; });
    return best;
}

function palEval(color) {
    let sc = 1000 * (palTotal(color) - palMaxOther(color));
    palPlay.forEach(function (s) {
        const h = palLevel(s.x, s.y);
        const rim = (s.x === 0 || s.x === PAL_W - 1);     // only the two outer edges are lethal now
        if (s.color === color) sc += 6 + h * 2 - (rim ? 5 : 0);
        else sc += -(h * 2) + (rim ? 5 : 0);
    });
    return sc;
}

function palAIMove() {
    if (!palIsAITurn()) return;
    const color = palTurn;
    const moves = palGenMoves(color);
    if (!moves.length) { palAfterMove(); return; }

    const snap = palSnapshot();
    const nextSeat = palNextAlive(color);
    let best = null, bestVal = -Infinity;
    moves.forEach(function (m) {
        palSimApply(m, color);
        const val = palEval(color) - 1000 * palBestSwing(nextSeat) + Math.random() * 5;   // don't hang material
        palRestore(snap);
        if (val > bestVal) { bestVal = val; best = m; }
    });
    palRestore(snap);
    palAIExecute(best);
}

function palAIExecute(m) {
    if (!m) { palAfterMove(); return; }
    palAIActing = true;
    if (m.kind === 'tier') { palSetTier(m.palace, m.band, m.delta); palAIActing = false; return; }
    if (m.kind === 'place') {
        palPool[palTurn][palColOffset(palTurn, m.x)] = false;
        palPlay.push({ id: palNextId++, color: palTurn, x: m.x, y: m.y, k: palLevel(m.x, m.y) });
        if (window.palaceSync3D) window.palaceSync3D();
        if (window.palaceAnimPlace) window.palaceAnimPlace(palNextId - 1, m.x, m.y);
        palLastPush = null;
        palResolveHadesAnimated(palTurn);
        palAfterMove(); palAIActing = false; return;
    }
    const s = palPlay.find(function (p) { return p.id === m.id; });
    if (!s) { palAfterMove(); palAIActing = false; return; }
    const r = palRollInDir(s, { dx: m.dx, dy: m.dy });
    if (!r) { palAfterMove(); palAIActing = false; return; }
    palApplyRoll(r);
    palLastPush = r.pushBack || null;
    palResolveHadesAnimated(palTurn);
    palAfterMove();
    palAIActing = false;
}

// ---- state out ----
function getPalState() {
    const targets = (palSel && !palWinner) ? palLegalForSelected() : [];
    const total = {}; PAL_PLAYERS.forEach(function (c) { total[c] = palTotal(c); });
    return {
        turn: palTurn, winner: palWinner, winReason: palWinReason,
        players: PAL_PLAYERS.slice(), seat: PAL_SEAT, alive: Object.assign({}, palAlive),
        selected: palSel,
        stones: palPlay.map(function (p) { return { id: p.id, color: p.color, x: p.x, y: p.y, k: p.k }; }),
        pool: { W: palPool.W.slice(), R: palPool.R.slice(), U: palPool.U.slice(), B: palPool.B.slice() },
        total: total,
        tiers: { A: palTierHeights.A.slice(), B: palTierHeights.B.slice() },
        freeMode: palFreeMode,
        aiTurn: palIsAITurn(),
        targets: targets,
        W: PAL_W, D: PAL_D, HALF: PAL_HALF
    };
}

function refreshPal() {
    if (window.palaceSync3D) window.palaceSync3D();

    PAL_PLAYERS.forEach(function (c) {
        const el = document.getElementById('score-' + c);
        if (el) el.textContent = palTotal(c);
        const hud = document.getElementById('hud-item-' + c);
        if (hud) {
            hud.classList.toggle('dead', !palAlive[c]);
            hud.classList.toggle('active-turn', !palWinner && palTurn === c);
        }
        const cnt = document.getElementById('hud-' + c + '-count');
        if (cnt) cnt.textContent = palTotal(c);
    });

    ['A', 'B'].forEach(function (palace) {
        for (let i = 0; i < PAL_BANDS; i++) {
            const el = document.getElementById('tier-' + palace + '-' + i);
            if (el) el.textContent = palTierHeights[palace][i];
        }
    });

    const ind = document.getElementById('player-indicator');
    const nm = document.getElementById('player-name');
    const prompt = document.getElementById('action-prompt');
    if (palWinner) {
        if (ind) ind.className = 'player-indicator ' + palColorClass(palWinner);
        if (nm) nm.textContent = PAL_SEAT[palWinner].name + ' wins!';
        if (prompt) {
            prompt.textContent = palWinReason === 'stuck'
                ? 'No moves left — ' + PAL_SEAT[palWinner].name + ' holds the most'
                : PAL_SEAT[palWinner].name + ' is the last palace standing';
        }
    } else {
        if (ind) ind.className = 'player-indicator ' + palColorClass(palTurn);
        if (nm) nm.textContent = (palIsAITurn() ? 'Computer' : PAL_SEAT[palTurn].name) + ' — ' + palTotal(palTurn) + ' spheres';
        if (prompt) {
            if (palIsAITurn()) prompt.textContent = 'Computer is thinking…';
            else if (palSel && palSel.kind === 'pool') prompt.textContent = 'Choose a pane on your entrance row';
            else if (palSel && palSel.kind === 'stone') prompt.textContent = 'Roll to slide or carom — red means a sphere goes over the rim';
            else prompt.textContent = 'Tap a sphere to roll, or place from your pool. Break rivals below 4 to win.';
        }
    }
}

function palColorClass(c) { return { W: 'white', B: 'black', R: 'red', U: 'blue' }[c]; }

function flashPal(msg) {
    const el = document.getElementById('game-message');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(window._palMsgT);
    window._palMsgT = setTimeout(function () { el.classList.add('hidden'); }, 1700);
}

window.getPalState = getPalState;
window.palLevel = palLevel;
window.palIsApex = palIsApex;
window.palBandHeight = palBandHeight;
window.palPalaceOf = palPalaceOf;
window.PAL_TIER_MIN = PAL_TIER_MIN;
window.PAL_TIER_MAX = PAL_TIER_MAX;
window.PAL_BANDS = PAL_BANDS;
window.PAL_HALF = PAL_HALF;
window.PAL_PLAYERS = PAL_PLAYERS;
window.PAL_SEAT = PAL_SEAT;
window.palEntranceRow = palEntranceRow;
window.palSeatCols = palSeatCols;
window.palColToX = palColToX;
window.palClear = palClear;
window.palSetFree = palSetFree;
window.palSetAI = palSetAI;
window.palIsAITurn = palIsAITurn;
window.palStartPlay = palStartPlay;
window.palPlayTapStone = palPlayTapStone;
window.palPlayTapTarget = palPlayTapTarget;
window.palTapPool = palTapPool;
window.palSetTier = palSetTier;
window.refreshPal = refreshPal;
