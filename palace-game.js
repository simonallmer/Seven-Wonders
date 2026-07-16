// ============================================
// PALACE — "The Carom"  (rolling glass spheres, momentum / elimination)
// ============================================
// The palace is five 8x2 glass BANDS, heights 1-3, starting 1-2-3-2-1.
// Whole bands raise or lower (Level Control handles on the building's edge).
//
// PIECES are glass spheres. The ROLL is the ONLY way a sphere moves — a single
// committed slide in a straight line, resolved by the terrain it crosses:
//   flat        — keep rolling
//   1 level UP  — HOP up, but ONLY from the pane directly below the step
//                 (you must be staged on your band's front edge); a flat run
//                 that only reaches a rise later stops at the wall instead
//   2+ up       — a wall; stop before it
//   1 level DOWN— drop and KEEP ROLLING on the lower level
//   2+ down     — drop and STAY where you land
//   a sphere you DROP onto (any colour) is SMASHED — it is out, you take its pane.
//
// CAROM: rolling into a sphere on the same tier shoves it exactly ONE pane along
//   (a clean push, not a slide); the striker takes the pane it vacated. Shove a
//   sphere off the rim and it dies. A sphere backed by a step, wall, or another
//   sphere won't budge, and the striker just stops against it.
// THE RIM is lethal: there is no railing. Any sphere rolled clean off the
//   building's edge FALLS and is destroyed — including your own.
//
// GOAL: reduce any opponent below 4 spheres (board + reserve pool).
// ============================================

const PAL_W = 8;
const PAL_D = 10;
const PAL_TIER_START = [1, 2, 3, 2, 1];   // five 8x2 bands, south to north
const PAL_TIER_MIN = 1;
const PAL_TIER_MAX = 3;
const PAL_STONES = 8;                      // one reserve per column, locked to its entry pane
const PAL_LOSE_BELOW = 4;                  // lose when total (board + reserve) drops below this — tune me

function palBand(y) { return Math.floor(y / 2); }
function palBandHeight(b) { return palTierHeights[b]; }
function palIsApex() { return false; }     // crown removed — kept as a safe stub for the 3D view
function palLevel(x, y) { return palTierHeights[palBand(y)]; }
function palInBounds(x, y) { return x >= 0 && x < PAL_W && y >= 0 && y < PAL_D; }
function palEntranceRow(color) { return color === 'W' ? 0 : PAL_D - 1; }

const PAL_DIRS = [{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 }];

// ---- state ----
let palPlay = [];                 // spheres on the building
let palTurn = 'W';
let palSel = null;                // {kind:'stone', id} | {kind:'pool'} | null
let palWinner = null;
let palWinReason = null;          // 'smash' | 'stuck' — how the game was won
let palNextId = 1;
let palPool = { W: palFullReserve(), B: palFullReserve() };  // per-column: true = reserve still off-board
let palTierHeights = PAL_TIER_START.slice();
let palFreeMode = false;          // sandbox: ignore turns, move any sphere
let palAI = 'B';                  // null | 'B' — colour the computer plays (human is White); ON by default
let palAIBusy = false;            // a computer move is scheduled/running
let palAIActing = false;          // the computer is driving a real move right now

function palKey(x, y) { return x + ',' + y; }
function palStoneAt(x, y) { return palPlay.find(function (s) { return s.x === x && s.y === y; }) || null; }
function palBoardCount(c) { return palPlay.filter(function (s) { return s.color === c; }).length; }
function palFullReserve() { const a = []; for (let x = 0; x < PAL_W; x++) a.push(true); return a; }
function palPoolCount(c) { return palPool[c].filter(Boolean).length; }
function palTotal(c) { return palPoolCount(c) + palBoardCount(c); }

function palClear() { palStartPlay(); }

function palSetFree(on) { palFreeMode = !!on; palSel = null; refreshPal(); }

function palStartPlay() {
    palPlay = []; palNextId = 1; palWinner = null; palWinReason = null;
    palPool = { W: palFullReserve(), B: palFullReserve() };
    palTierHeights = PAL_TIER_START.slice();
    palTurn = 'W'; palSel = null;
    const box = document.getElementById('message-box');
    if (box) box.classList.remove('visible');
    refreshPal();
}

// ---- LEVEL CONTROL ----
function palSetTier(band, delta) {
    if (palWinner) return;
    if (palIsAITurn() && !palAIActing) return;   // human can't work levels on the computer's turn
    if (band < 0 || band >= palTierHeights.length) return;
    const next = palTierHeights[band] + delta;
    if (next < PAL_TIER_MIN || next > PAL_TIER_MAX) return;

    // In real play a band only answers to a player who has a sphere standing on
    // it, and working the level control spends the turn (it IS your action).
    // Free Move lifts both restrictions.
    if (!palFreeMode) {
        const owns = palPlay.some(function (s) { return s.color === palTurn && palBand(s.y) === band; });
        if (!owns) { flashPal('You need a sphere on that band to work its level'); return; }
    }

    palTierHeights[band] = next;
    palPlay.forEach(function (s) { s.k = palLevel(s.x, s.y); });   // spheres ride the band
    palSel = null;

    if (palFreeMode) { refreshPal(); return; }
    palAfterMove();                                                // costs the turn
}

// ---- targets ----
// Resolve one committed roll of sphere `s` in direction `d`. The roll is the
// ONLY way a sphere moves — a single committed slide, resolved by the terrain:
//   flat            keep rolling
//   1 up (staged)   hop; only as a first move from the pane below the step
//   2+ up / wall    stop before it
//   1/2+ down       drop and keep rolling / hard-drop and stay
//   drop onto sphere SMASH it, land on its pane
// CAROM: roll into a sphere on the same tier and it is shoved exactly ONE pane
//   further along (a clean push, not a slide). Shove it off a side edge and it
//   dies. A sphere with anything behind it (a sphere, a step, a wall) won't budge.
// EDGES: the two long SIDE edges (x) are a sheer, lethal drop — roll off and the
//   sphere falls and shatters. The two ENTRANCE edges (y, the pool sides) have a
//   low lip: a sphere rolled toward its own baseline just stops there, safe.
//
// Returns null (nothing changes — illegal) or a consequence:
//   { type,   // 'roll' | 'hop' | 'smash' | 'fall' | 'carom'
//     render: {x,y},                    // where to draw the target marker
//     moves:  [{id,x,y}],               // spheres repositioned
//     kills:  [{id,mode,x,y,k,dx,dy}] } // spheres destroyed (mode 'smash'|'fall')
function palRollInDir(s, d) {
    const moves = [];
    const kills = [];
    let cx = s.x, cy = s.y, lv = palLevel(cx, cy);
    let firstStep = true, didHop = false, sFell = false;

    function stopBefore() { if (cx !== s.x || cy !== s.y) moves.push({ id: s.id, x: cx, y: cy }); }

    while (true) {
        const nx = cx + d.dx, ny = cy + d.dy;

        if (!palInBounds(nx, ny)) {                            // reached an edge
            if (nx < 0 || nx >= PAL_W) {                       // side edge — sheer lethal drop
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
                if (px < 0 || px >= PAL_W) {                  // shoved over a side edge — it dies
                    kills.push({ id: occ.id, mode: 'fall', x: nx, y: ny, k: nlv, dx: d.dx, dy: d.dy });
                    moves.push({ id: s.id, x: nx, y: ny });   // striker takes the vacated pane
                } else if (!palInBounds(px, py)) {            // shoved against the pool-side lip — it holds
                    stopBefore();
                } else if (palLevel(px, py) === nlv && !palStoneAt(px, py)) {
                    moves.push({ id: occ.id, x: px, y: py });  // clean push onto an empty same-tier pane
                    moves.push({ id: s.id, x: nx, y: ny });
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
        if (nlv >= lv + 2) { stopBefore(); break; }           // wall

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

    if (!moves.length && !kills.length) return null;          // nothing changed — not a legal roll

    const sMove = moves.find(function (m) { return m.id === s.id; });
    let type = 'roll';
    if (didHop) type = 'hop';
    else if (sFell) type = 'fall';
    else if (kills.some(function (k) { return k.mode === 'smash'; })) type = 'smash';
    else if (kills.length) type = 'carom';                    // s lives but shoved a sphere off the rim

    let render;
    if (sMove) render = { x: sMove.x, y: sMove.y };
    else if (sFell) { const kf = kills.find(function (k) { return k.id === s.id; }); render = { x: kf.x, y: kf.y }; }
    else if (kills.length) render = { x: kills[0].x, y: kills[0].y };
    else render = { x: s.x, y: s.y };

    return { type: type, render: render, moves: moves, kills: kills };
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
    for (let x = 0; x < PAL_W; x++) {
        if (!palPool[color][x]) continue;     // this column's reserve is already deployed
        if (palStoneAt(x, y)) continue;
        if (palLevel(x, y) !== 1) continue;   // enter only where your band is at ground height
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
    // working the level control is also an action: any band this colour stands on
    // can move at least one way (heights live between MIN and MAX).
    for (let b = 0; b < palTierHeights.length; b++) {
        if ((palTierHeights[b] < PAL_TIER_MAX || palTierHeights[b] > PAL_TIER_MIN) &&
            palPlay.some(function (s) { return s.color === color && palBand(s.y) === b; })) return true;
    }
    return false;
}

// ---- interaction ----
function palPlayTapStone(id) {
    if (palWinner || palIsAITurn()) return;
    const s = palPlay.find(function (p) { return p.id === id; });
    if (!s) return;
    if (palFreeMode) palTurn = s.color;
    if (s.color !== palTurn) { flashPal((palTurn === 'W' ? 'White' : 'Black') + ' to move'); return; }
    palSel = (palSel && palSel.kind === 'stone' && palSel.id === id) ? null : { kind: 'stone', id: id };
    refreshPal();
}

function palTapPool(color) {
    if (palWinner || palIsAITurn()) return;
    if (palFreeMode) palTurn = color;
    if (color !== palTurn) { flashPal((palTurn === 'W' ? 'White' : 'Black') + ' to move'); return; }
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
        palPool[palTurn][t.x] = false;   // that column's reserve is now on the board
        palPlay.push({ id: palNextId++, color: palTurn, x: t.x, y: t.y, k: palLevel(t.x, t.y) });
        if (window.palaceSync3D) window.palaceSync3D();
        if (window.palaceAnimPlace) window.palaceAnimPlace(palNextId - 1, t.x, t.y);
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

    palWinner = palCheckWin();
    palAfterMove();
}

// Commit a resolved roll: relocate every moved sphere, destroy every killed one,
// and fire the matching animations (snapshot original positions first).
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
        // fall starts from the RIM pane the sphere tipped over (k.x,k.y), not its origin,
        // so it sails outward off the edge instead of dropping in place mid-board.
        else if (k.mode === 'fall' && window.palaceAnimFallOff) window.palaceAnimFallOff(k.id, { x: k.x, y: k.y, k: k.k }, k.dx, k.dy);
    });
    r.moves.forEach(function (m) {
        const f = from[m.id];
        if (f && window.palaceAnimStoneMove) window.palaceAnimStoneMove(m.id, f, { x: m.x, y: m.y, k: palLevel(m.x, m.y) }, 'roll');
    });
}

function palCheckWin() {
    const wDead = palTotal('W') < PAL_LOSE_BELOW;
    const bDead = palTotal('B') < PAL_LOSE_BELOW;
    let w = null;
    if (wDead && !bDead) w = 'B';
    else if (bDead && !wDead) w = 'W';
    if (w) palWinReason = 'smash';
    return w;
}

function palAfterMove() {
    palSel = null;
    if (palWinner) { refreshPal(); if (window.palaceWin) window.palaceWin(palWinner); return; }
    if (palFreeMode) { refreshPal(); return; }
    palTurn = palTurn === 'W' ? 'B' : 'W';
    // A player who cannot make any legal move on their turn LOSES.
    if (!palHasAnyAction(palTurn)) {
        palWinner = palTurn === 'W' ? 'B' : 'W';
        palWinReason = 'stuck';
        refreshPal();
        if (window.palaceWin) window.palaceWin(palWinner);
        return;
    }
    refreshPal();
    if (palIsAITurn()) palAIKick();
}

// ============================================
// COMPUTER OPPONENT  (plays Black; human is White)
// ============================================
function palIsAITurn() { return !!palAI && !palFreeMode && !palWinner && palTurn === palAI; }

function palSetAI(on) {
    palAI = on ? 'B' : null;
    palAIBusy = false;
    refreshPal();
    if (palIsAITurn()) palAIKick();       // it may already be the computer's turn
}

function palAIKick() {
    if (palAIBusy || !palIsAITurn()) return;
    palAIBusy = true;
    setTimeout(function () { palAIBusy = false; palAIMove(); }, 620);   // let the human's move settle
}

// --- every legal move for a colour: {kind:'place'|'roll'|'tier', ...} ---
function palGenMoves(color) {
    const out = [];
    palPlaceTargets(color).forEach(function (t) { out.push({ kind: 'place', x: t.x, y: t.y }); });
    palPlay.forEach(function (s) {
        if (s.color !== color) return;
        palStoneTargets(s).forEach(function (t) { out.push({ kind: 'roll', id: s.id, dx: t.dx, dy: t.dy }); });
    });
    for (let b = 0; b < palTierHeights.length; b++) {
        if (!palPlay.some(function (s) { return s.color === color && palBand(s.y) === b; })) continue;
        if (palTierHeights[b] < PAL_TIER_MAX) out.push({ kind: 'tier', band: b, delta: 1 });
        if (palTierHeights[b] > PAL_TIER_MIN) out.push({ kind: 'tier', band: b, delta: -1 });
    }
    return out;
}

// --- snapshot / restore for search (no animation, no turn flip) ---
function palSnapshot() {
    return {
        play: palPlay.map(function (p) { return { id: p.id, color: p.color, x: p.x, y: p.y, k: p.k }; }),
        tiers: palTierHeights.slice(),
        pool: { W: palPool.W.slice(), B: palPool.B.slice() },
        turn: palTurn, nextId: palNextId
    };
}
function palRestore(s) {
    palPlay = s.play.map(function (p) { return { id: p.id, color: p.color, x: p.x, y: p.y, k: p.k }; });
    palTierHeights = s.tiers.slice();
    palPool = { W: s.pool.W.slice(), B: s.pool.B.slice() };
    palTurn = s.turn; palNextId = s.nextId;
}
function palSimApply(m, color) {
    if (m.kind === 'place') {
        palPool[color][m.x] = false;
        palPlay.push({ id: palNextId++, color: color, x: m.x, y: m.y, k: palLevel(m.x, m.y) });
        return;
    }
    if (m.kind === 'tier') {
        palTierHeights[m.band] += m.delta;
        palPlay.forEach(function (s) { s.k = palLevel(s.x, s.y); });
        return;
    }
    const s = palPlay.find(function (p) { return p.id === m.id; });
    if (!s) return;
    const r = palRollInDir(s, { dx: m.dx, dy: m.dy });
    if (!r) return;
    r.kills.forEach(function (k) { const i = palPlay.findIndex(function (p) { return p.id === k.id; }); if (i >= 0) palPlay.splice(i, 1); });
    r.moves.forEach(function (mv) { const p = palPlay.find(function (q) { return q.id === mv.id; }); if (p) { p.x = mv.x; p.y = mv.y; p.k = palLevel(mv.x, mv.y); } });
}

// net spheres a single move removes: +1 per enemy killed, -1 per own lost (no state change)
function palMoveSwing(m, color) {
    if (m.kind !== 'roll') return 0;
    const s = palPlay.find(function (p) { return p.id === m.id; });
    if (!s) return 0;
    const r = palRollInDir(s, { dx: m.dx, dy: m.dy });
    if (!r || !r.kills.length) return 0;
    let swing = 0;
    r.kills.forEach(function (k) {
        const v = palPlay.find(function (p) { return p.id === k.id; });
        if (v) swing += (v.color === color) ? -1 : 1;
    });
    return swing;
}
function palBestSwing(color) {
    let best = 0;
    palGenMoves(color).forEach(function (m) { const sw = palMoveSwing(m, color); if (sw > best) best = sw; });
    return best;
}

// static value of the position for `color` (material dominates)
function palEval(color) {
    const opp = color === 'W' ? 'B' : 'W';
    let sc = 1000 * (palTotal(color) - palTotal(opp));
    palPlay.forEach(function (s) {
        const h = palLevel(s.x, s.y);
        const rim = (s.x === 0 || s.x === PAL_W - 1 || s.y === 0 || s.y === PAL_D - 1);
        if (s.color === color) sc += 6 + h * 2 - (rim ? 5 : 0);   // deploy, gain height, keep off the rim
        else sc += -(h * 2) + (rim ? 5 : 0);                      // enemy height is a threat; enemy on the rim, an opening
    });
    return sc;
}

function palAIMove() {
    if (!palIsAITurn()) return;
    const color = palAI, opp = color === 'W' ? 'B' : 'W';
    const moves = palGenMoves(color);
    if (!moves.length) { palAfterMove(); return; }

    const snap = palSnapshot();
    let best = null, bestVal = -Infinity;
    moves.forEach(function (m) {
        palSimApply(m, color);
        // my resulting value, minus the material the opponent could grab in reply (don't hang pieces)
        const val = palEval(color) - 1000 * palBestSwing(opp) + Math.random() * 5;
        palRestore(snap);
        if (val > bestVal) { bestVal = val; best = m; }
    });
    palRestore(snap);
    palAIExecute(best);
}

// run the chosen move through the REAL animated path
function palAIExecute(m) {
    if (!m) { palAfterMove(); return; }
    palAIActing = true;
    if (m.kind === 'tier') { palSetTier(m.band, m.delta); palAIActing = false; return; }
    if (m.kind === 'place') {
        palPool[palTurn][m.x] = false;
        palPlay.push({ id: palNextId++, color: palTurn, x: m.x, y: m.y, k: palLevel(m.x, m.y) });
        if (window.palaceSync3D) window.palaceSync3D();
        if (window.palaceAnimPlace) window.palaceAnimPlace(palNextId - 1, m.x, m.y);
        palAfterMove(); palAIActing = false; return;
    }
    const s = palPlay.find(function (p) { return p.id === m.id; });
    if (!s) { palAfterMove(); palAIActing = false; return; }
    const r = palRollInDir(s, { dx: m.dx, dy: m.dy });
    if (!r) { palAfterMove(); palAIActing = false; return; }
    palApplyRoll(r);
    palWinner = palCheckWin();
    palAfterMove();
    palAIActing = false;
}

// ---- state out ----
function getPalState() {
    const targets = (palSel && !palWinner) ? palLegalForSelected() : [];
    return {
        turn: palTurn, winner: palWinner, winReason: palWinReason,
        selected: palSel,
        stones: palPlay.map(function (p) { return { id: p.id, color: p.color, x: p.x, y: p.y, k: p.k }; }),
        pool: { W: palPool.W.slice(), B: palPool.B.slice() },
        total: { W: palTotal('W'), B: palTotal('B') },
        tiers: palTierHeights.slice(),
        freeMode: palFreeMode,
        targets: targets,
        W: PAL_W, D: PAL_D
    };
}

function refreshPal() {
    if (window.palaceSync3D) window.palaceSync3D();

    const ws = document.getElementById('w-score');
    if (ws) ws.textContent = palTotal('W');
    const bs = document.getElementById('b-score');
    if (bs) bs.textContent = palTotal('B');

    for (let i = 0; i < palTierHeights.length; i++) {
        const el = document.getElementById('tier-val-' + i);
        if (el) el.textContent = palTierHeights[i];
    }

    const btnStone = document.getElementById('btn-place-stone');
    if (btnStone) {
        btnStone.style.display = (!palWinner && palPoolCount(palTurn) > 0) ? '' : 'none';
        btnStone.classList.toggle('active', !!(palSel && palSel.kind === 'pool'));
    }

    const ind = document.getElementById('player-indicator');
    const nm = document.getElementById('player-name');
    const prompt = document.getElementById('action-prompt');
    if (palWinner) {
        if (ind) ind.className = 'player-indicator ' + (palWinner === 'W' ? 'white' : 'black');
        if (nm) nm.textContent = (palWinner === 'W' ? 'White' : 'Black') + ' wins!';
        if (prompt) {
            const loser = (palWinner === 'W' ? 'Black' : 'White');
            prompt.textContent = palWinReason === 'stuck'
                ? loser + ' has no legal move'
                : loser + ' is smashed below ' + PAL_LOSE_BELOW + ' spheres';
        }
    } else {
        if (ind) ind.className = 'player-indicator ' + (palTurn === 'W' ? 'white' : 'black');
        if (nm) nm.textContent = (palIsAITurn() ? 'Computer' : (palTurn === 'W' ? 'White' : 'Black')) + ' — ' + palTotal(palTurn) + ' spheres';
        if (prompt) {
            if (palIsAITurn()) {
                prompt.textContent = 'Computer is thinking…';
            } else if (palSel && palSel.kind === 'pool') {
                prompt.textContent = 'Choose a pane on your entrance row';
            } else if (palSel && palSel.kind === 'stone') {
                prompt.textContent = 'Roll to slide or carom — red means a sphere goes over the rim';
            } else {
                prompt.textContent = 'Tap a sphere to roll, or place from your pool. Smash foes below 4 to win.';
            }
        }
    }
}

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
window.PAL_TIER_MIN = PAL_TIER_MIN;
window.PAL_TIER_MAX = PAL_TIER_MAX;
window.PAL_BANDS = PAL_TIER_START.length;
window.palEntranceRow = palEntranceRow;
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
