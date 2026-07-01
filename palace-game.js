// ============================================
// PALACE — "The Span"  (Exhibition: Artifacts & Glass)
// ============================================
// GOAL: First to 20 points. Place artifacts on glass caps (1/2/4 pts/turn).
//       Steal enemy artifacts. Capture enemy stones to set them back.
//
// MOVES:
//   RUN — roll in a straight line; land on an enemy = capture.
//   PORTAL PASSAGE — at (1,3) or (7,3), warp to other portal in one move.
//
// ACTIONS:
//   PLACE — on a glass cap while carrying → place your artifact there.
//   REGROW — empty stone uses its turn to regain its artifact.
// ============================================

const PAL_W = 9;
const PAL_D = 7;
const PAL_ROW_LEVEL = [1, 2, 3, 2, 1];
const PAL_MAXK = 3;
const PAL_STONES = 5;
const PAL_WIN_SCORE = 20;

function palLevel(x, y) {
    if (x === 0 || x === PAL_W - 1 || y === 0 || y === PAL_D - 1) return 1;
    return PAL_ROW_LEVEL[y - 1];
}
function palIsRidge(x, y) { return palLevel(x, y) >= 3; }
function palIsGlass(x, y) { return x > 0 && x < PAL_W - 1 && y > 0 && y < PAL_D - 1; }
function palIsPortal(x, y) {
    return y === 3 && (x === 1 || x === PAL_W - 2);
}
function palInBounds(x, y) { return x >= 0 && x < PAL_W && y >= 0 && y < PAL_D; }
function palLevelSafe(x, y) { return palInBounds(x, y) ? palLevel(x, y) : 0; }
function palArtifactScore(x, y) {
    if (!palIsGlass(x, y)) return 0;
    const lv = palLevel(x, y);
    return lv === 3 ? 4 : lv;
}

const PAL_DIRS = [{ dx: 1, dz: 0 }, { dx: -1, dz: 0 }, { dx: 0, dz: 1 }, { dx: 0, dz: -1 }];

function palSolidAt(x, y, k) { return palInBounds(x, y) && k >= 0 && k < palLevel(x, y); }

// ---- state ----
let palPhase = 'play';
let palPlay = [];
let palTurn = 'W';
let palSel = null;
let palWinner = null;
let palNextId = 1;

let palArtifacts = {};
let palScore = { W: 0, B: 0 };
let palCapturing = null;
let palLaserMode = false;

function palClear() {
    palStartPlay();
}

// ---- stone helpers ----
function palStoneAt(x, y) { return palPlay.find(function (s) { return s.x === x && s.y === y; }) || null; }
function palPlayK(x, y) {
    if (x === 0 || x === PAL_W - 1 || y === 0 || y === PAL_D - 1) return 0;
    return palLevel(x, y);
}

function palArtifactAt(x, y) { return palArtifacts[x + ',' + y] || null; }

function palCanPlaceHere(x, y) {
    if (!palIsGlass(x, y)) return false;
    return !palArtifacts[x + ',' + y];
}

// ---- LASER targets ----
function palLaserTargets(s) {
    const out = [];
    PAL_DIRS.forEach(function (d) {
        let cx = s.x, cy = s.y;
        for (let step = 0; step < 40; step++) {
            const nx = cx + d.dx, ny = cy + d.dz;
            if (!palInBounds(nx, ny)) break;
            const cellK = palPlayK(nx, ny);
            const art = palArtifactAt(nx, ny);
            // Enemy artifact blocks at any height — the glass column is territorial
            if (art && art !== s.color) {
                out.push({ x: nx, y: ny, k: cellK, type: 'laser', destroyArtifact: art });
                break;
            }
            // Enemy stone only if at same level
            if (cellK === s.k) {
                const occ = palStoneAt(nx, ny);
                if (occ && occ.color !== s.color) {
                    out.push({ x: nx, y: ny, k: cellK, type: 'laser', eliminate: occ.id });
                    break;
                }
            }
            cx = nx; cy = ny;
        }
    });
    return out;
}

// ---- RUN targets ----
function palRunTargets(s) {
    const out = [];
    if (palIsPortal(s.x, s.y)) {
        const otherX = s.x === 1 ? 7 : 1;
        const other = { x: otherX, y: 3 };
        if (!palStoneAt(other.x, other.y)) {
            out.push({ x: other.x, y: other.y, k: palPlayK(other.x, other.y), type: 'portal' });
        }
    }
    PAL_DIRS.forEach(function (d) {
        let cx = s.x, cy = s.y;
        for (let step = 0; step < 40; step++) {
            const nx = cx + d.dx, ny = cy + d.dz;
            if (!palInBounds(nx, ny)) break;
            const occ = palStoneAt(nx, ny);
            const k = palPlayK(nx, ny);
            if (occ) {
                if (occ.color !== s.color) out.push({ x: nx, y: ny, k: k, type: 'run', capture: occ.id });
                break;
            }
            const art = palArtifactAt(nx, ny);
            const steal = !s.carrying && art && art !== s.color;
            out.push({ x: nx, y: ny, k: k, type: 'run', steal: !!steal });
            cx = nx; cy = ny;
        }
    });
    return out;
}

function palLegalForSelected() {
    const s = palPlay.find(function (p) { return p.id === palSel; });
    if (!s) return { targets: [], canRegrow: false, canPlace: false, canFire: false };
    if (palLaserMode) {
        return { targets: palLaserTargets(s), canRegrow: false, canPlace: false, canFire: true };
    }
    const targets = palRunTargets(s);
    const canRegrow = !s.carrying;
    const canPlace = s.carrying && palCanPlaceHere(s.x, s.y);
    return { targets: targets, canRegrow: canRegrow, canPlace: canPlace, canFire: true };
}

// ---- PLAY ----
function palStartPlay() {
    palPlay = []; palNextId = 1; palWinner = null;
    palArtifacts = {}; palScore = { W: 0, B: 0 };
    palCapturing = null;
    for (let x = 2; x <= 6; x++) {
        palPlay.push({ color: 'W', x: x, y: 0, k: palPlayK(x, 0), id: palNextId++, carrying: true });
        palPlay.push({ color: 'B', x: x, y: PAL_D - 1, k: palPlayK(x, PAL_D - 1), id: palNextId++, carrying: true });
    }
    palPhase = 'play'; palTurn = 'W'; palSel = null; palLaserMode = false;
    refreshPal();
}


function palPlayTapStone(id) {
    if (palWinner || palCapturing) return;
    const s = palPlay.find(function (p) { return p.id === id; });
    if (!s) return;
    if (s.color !== palTurn) { flashPal((palTurn === 'W' ? 'White' : 'Black') + ' to move'); return; }
    palLaserMode = false;
    palSel = (palSel === id) ? null : id;
    refreshPal();
}

function palPlayTapTarget(t) {
    if (palWinner || palCapturing) return;
    const s = palPlay.find(function (p) { return p.id === palSel; });
    if (!s) return;

    if (t.type === 'laser') {
        palHandleLaser(s, t);
        return;
    }

    palSel = null;

    if (t.type === 'portal') {
        s.x = t.x; s.y = t.y; s.k = palPlayK(t.x, t.y);
        palAfterMove(s);
        return;
    }

    if (t.capture != null) {
        palHandleCapture(s, t);
        return;
    }

    // Regular move
    if (window.palaceAnimStoneMove) {
        window.palaceAnimStoneMove(s.id, { x: s.x, y: s.y, k: s.k }, { x: t.x, y: t.y, k: palPlayK(t.x, t.y) }, 'run');
    }
    s.x = t.x; s.y = t.y; s.k = palPlayK(t.x, t.y);

    if (t.steal && palArtifacts[t.x + ',' + t.y] && palArtifacts[t.x + ',' + t.y] !== s.color) {
        palArtifacts[t.x + ',' + t.y] = s.color;
    }

    palAfterMove(s);
}

function palHandleCapture(attacker, t) {
    const defIdx = palPlay.findIndex(function (p) { return p.id === t.capture; });
    if (defIdx < 0) return;
    const defender = palPlay[defIdx];
    const defColor = defender.color;

    const capturedArtifact = defender.carrying;
    const attackerEmpty = !attacker.carrying;

    // Move attacker to defender's cell
    attacker.x = defender.x; attacker.y = defender.y;
    attacker.k = palPlayK(defender.x, defender.y);

    // Remove defender from play permanently
    palPlay.splice(defIdx, 1);

    // Steal an enemy artifact if attacker is empty
    if (attackerEmpty) {
        const artKeys = Object.keys(palArtifacts).filter(function (k) { return palArtifacts[k] === defColor; });
        if (artKeys.length > 0) {
            const stolen = artKeys[0];
            palArtifacts[stolen] = attacker.color;
        }
    }

    // Transfer carried artifact to attacker
    if (capturedArtifact) {
        attacker.carrying = true;
    }

    palAfterMove(attacker);
}

function palAfterMove(s) {
    palScoreArtifacts();
    palSel = null;
    const w = palCheckWin();
    if (w) {
        palWinner = w;
        refreshPal();
        if (window.palaceWin) window.palaceWin(w);
        return;
    }
    palTurn = palTurn === 'W' ? 'B' : 'W';
    refreshPal();
}

// ---- ACTIONS ----
function palActionPlace() {
    const s = palPlay.find(function (p) { return p.id === palSel; });
    if (!s || !s.carrying || !palCanPlaceHere(s.x, s.y)) return;
    palArtifacts[s.x + ',' + s.y] = s.color;
    s.carrying = false;
    palAfterMove(s);
}

function palActionRegrow() {
    const s = palPlay.find(function (p) { return p.id === palSel; });
    if (!s || s.carrying) return;
    s.carrying = true;
    palAfterMove(s);
}

function palHandleLaser(s, t) {
    if (palWinner) return;
    if (t.destroyArtifact) {
        delete palArtifacts[t.x + ',' + t.y];
    }
    if (t.eliminate) {
        const idx = palPlay.findIndex(function (p) { return p.id === t.eliminate; });
        if (idx >= 0) {
            const target = palPlay[idx];
            if (target.carrying) {
                target.carrying = false;
            } else {
                palPlay.splice(idx, 1);
            }
        }
    }
    if (window.palaceAnimLaserHit) {
        window.palaceAnimLaserHit(s.x, s.y, t.x, t.y, t.destroyArtifact ? 'artifact' : 'stone');
    }
    palAfterMove(s);
}

function palActionFire() {
    palLaserMode = !palLaserMode;
    refreshPal();
}

// ---- SCORING ----
function palScoreArtifacts() {
    Object.keys(palArtifacts).forEach(function (key) {
        if (palArtifacts[key] !== palTurn) return;
        const parts = key.split(',');
        const x = +parts[0], y = +parts[1];
        palScore[palTurn] += palArtifactScore(x, y);
    });
}

function palCheckWin() {
    if (palScore.W >= PAL_WIN_SCORE) return 'W';
    if (palScore.B >= PAL_WIN_SCORE) return 'B';
    return null;
}

// ---- state out ----
function getPalState() {
    const sel = palPlay.find(function (p) { return p.id === palSel; });
    const legal = (sel && !palWinner && !palCapturing) ? palLegalForSelected() : { targets: [], canRegrow: false, canPlace: false, canFire: false };
    const artifacts = Object.keys(palArtifacts).map(function (k) {
        const parts = k.split(',');
        return { x: +parts[0], y: +parts[1], color: palArtifacts[k] };
    });
    return {
        phase: 'play', turn: palTurn, selected: palSel, winner: palWinner,
        stones: palPlay.map(function (p) { return { id: p.id, color: p.color, x: p.x, y: p.y, k: p.k, carrying: p.carrying }; }),
        targets: legal.targets,
        canRegrow: legal.canRegrow,
        canPlace: legal.canPlace,
        canFire: legal.canFire,
        laserMode: palLaserMode,
        artifacts: artifacts,
        score: { W: palScore.W, B: palScore.B },
        goalW: 0, goalB: PAL_W - 1, W: PAL_W, D: PAL_D
    };
}

function refreshPal() {
    if (window.palaceSync3D) window.palaceSync3D();

    const playChips = document.getElementById('play-chips');
    if (playChips) playChips.style.display = '';

    const btnPlace = document.getElementById('btn-place');
    const btnRegrow = document.getElementById('btn-regrow');
    const btnFire = document.getElementById('btn-fire');
    if (palSel && !palWinner) {
        const sel = palPlay.find(function (p) { return p.id === palSel; });
        if (btnPlace) {
            const canShow = sel && sel.carrying && palCanPlaceHere(sel.x, sel.y);
            btnPlace.style.display = canShow ? '' : 'none';
        }
        if (btnRegrow) {
            btnRegrow.style.display = sel && !sel.carrying ? '' : 'none';
        }
        if (btnFire) {
            btnFire.style.display = '';
            btnFire.textContent = palLaserMode ? '⏎ Exit Laser' : '🔥 Fire Laser';
        }
    } else {
        if (btnPlace) btnPlace.style.display = 'none';
        if (btnRegrow) btnRegrow.style.display = 'none';
        if (btnFire) btnFire.style.display = 'none';
    }

    const ind = document.getElementById('player-indicator');
    const nm = document.getElementById('player-name');
    const prompt = document.getElementById('action-prompt');

    const ws = document.getElementById('w-score');
    if (ws) ws.textContent = palScore.W;
    const bs = document.getElementById('b-score');
    if (bs) bs.textContent = palScore.B;

    if (palWinner) {
        if (ind) ind.className = 'player-indicator ' + (palWinner === 'W' ? 'white' : 'black');
        if (nm) nm.textContent = (palWinner === 'W' ? 'White' : 'Black') + ' wins!';
        if (prompt) prompt.textContent = (palWinner === 'W' ? 'White' : 'Black') + ' reaches ' + PAL_WIN_SCORE + ' points!';
    } else {
        if (ind) ind.className = 'player-indicator ' + (palTurn === 'W' ? 'white' : 'black');
        if (nm) nm.textContent = (palTurn === 'W' ? 'White' : 'Black') + ' — ' + palScore[palTurn] + ' pts';
        if (prompt) {
            if (palLaserMode && !palSel) {
                prompt.textContent = 'Tap a stone to fire laser, or tap L to exit laser mode';
            } else if (!palSel) {
                prompt.textContent = 'Tap your stone to move, or tap empty stone to Regrow';
            } else {
                const sel = palPlay.find(function (p) { return p.id === palSel; });
                if (palLaserMode) {
                    prompt.textContent = 'Red markers for laser targets. Tap L to exit laser mode.';
                } else if (sel && sel.carrying) {
                    prompt.textContent = 'Blue circles to move. Tap Place Artifact on glass cap.';
                } else if (sel && !sel.carrying) {
                    prompt.textContent = 'Blue circles to move + steal. Tap Regrow. Eliminate enemy stones on contact.';
                } else {
                    prompt.textContent = 'Blue circles — run to move';
                }
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
window.palIsRidge = palIsRidge;
window.palIsPortal = palIsPortal;
window.palSolidAt = palSolidAt;
window.palClear = palClear;
window.palStartPlay = palStartPlay;
window.palPlayTapStone = palPlayTapStone;
window.palPlayTapTarget = palPlayTapTarget;
window.palActionPlace = palActionPlace;
window.palActionRegrow = palActionRegrow;
window.palActionFire = palActionFire;
window.refreshPal = refreshPal;
