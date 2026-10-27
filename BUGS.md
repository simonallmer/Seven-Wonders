# Bug list — internal

Running list of known defects in the games, kept so a problem that was once
noticed does not get lost before it is reproduced. One entry per defect.

Status values: **fixed** (with the commit), **open** (confirmed, not fixed),
**watch** (reported but not currently reproducible), **wontfix**.

Keep the repro steps concrete enough that someone else can follow them, and
record the measurement, not just the impression — "about half my clicks on a
field did nothing" is a start, "36–48% of the field registered" is a bug
report.

---

## Pharos

### P-1 — 3D view throws on load, killing the rest of init3D — **fixed**

`sync3D()` guarded only `typeof board === 'undefined'`, but `pyramid-game.js`
declares `let board = []` and fills it in `initializeBoard()` on
`DOMContentLoaded`, while `pharos.html` kicks off `init3D()` from a
`setTimeout(..., 0)`. Whichever wins the race decides whether the board exists.
When `init3D` won, `board[r][c]` threw on an empty array.

The throw mattered beyond the console: it aborted `init3D()` at the
`sync3D()` call, so everything after it — including the `keydown` handler
that opens the menu with Space — was never registered.

- Repro: hard-reload `pharos.html` until the console shows
  `Cannot read properties of undefined (reading '0')`. Timing-dependent;
  it reproduced on every cold load in testing.
- Fix: `sync3D()` also returns early when `board.length < BOARD_SIZE`. The
  later `rebuild3DBoard()` from `initializeBoard()` populates the pieces.
- Affected: full game and demo, identical code. Both patched.

### P-2 — init3D still races initializeBoard — **open** (low)

P-1 makes the race harmless, but the ordering is still luck. `init3D()` should
wait for `DOMContentLoaded` rather than a zero timeout, so the first
`sync3D()` is the one that draws the pieces.

---

## Pyramid

### Y-1 — valid destinations only 36–48% clickable — **fixed**

Each tier of the pyramid overhangs the ring below it. From the default camera
the middle of a level-0 field is hidden behind the level-1 tier, so a click
aimed at a destination's centre hit the tier in front and the move was
silently dropped — the player saw the marker, clicked it, and nothing
happened. This is almost certainly the "it didn't register movements that
should be possible" report.

- Repro: start a game, select a front-row white stone, click the middle of
  any marked destination on the left rim. Before the fix most clicks
  deselected instead of moving.
- Measured: sampling a 5x5 grid over each destination's footprint, 36–48% of
  points resolved to the intended field. After the fix, 100% on all five.
- Fix: `pickTarget()` resolves a field the player has already been offered
  ahead of whatever occludes it, and falls back to the nearest hit otherwise.
  This also removed a blanket "stones beat cells" rule that could let a stone
  behind an empty field steal a click.
- Note: the fix is independent of the Hints setting — turning hints off
  changes what is drawn, never where a click lands.

### Y-2 — ghost and corpse stones — **watch**

Reported as "artifacts of stones". Three guards for this already exist in the
current working copy: rebuilding a mesh whose field changed owner, refusing to
overwrite a key that still holds a mesh, and clearing `userData` on a captured
stone so a corpse cannot answer clicks. No ghost reproduced in this pass, but
the pass was scripted rather than played, so this needs real play before it is
called fixed.

### Y-3 — the side menu covers its own toggle — **open**

With `#side-menu` open, the menu panel (`z-index: 999`) sits over
`#menu-toggle`, so clicking the toggle again hits `menu-content` instead of
closing the menu. Found while driving the UI in tests. Pyramid has no
`#close-menu-btn` (other games do), so the menu is closed by clicking outside
it.

---

## Test recipes

### Is a field actually clickable?

Occlusion bugs do not show up by clicking once in the middle. Sample the
field's footprint and count:

```js
const v = view3D, rect = v.container.getBoundingClientRect();
const base = v.getWorldPosition(level, row, col);
let total = 0, ok = 0;
for (let dx = -0.4; dx <= 0.4001; dx += 0.2)
  for (let dz = -0.4; dz <= 0.4001; dz += 0.2) {
    const p = base.clone(); p.x += dx; p.z += dz; p.project(v.camera);
    const cx = rect.left + (p.x + 1) / 2 * rect.width;
    const cy = rect.top + (-p.y + 1) / 2 * rect.height;
    const hit = v.pickTarget(cx, cy);
    total++;
    if (hit && hit.level === level && hit.row === row && hit.col === col) ok++;
  }
```

### Is a highlight actually visible?

The sand tiles render near white in sunlight, so an added glow saturates and
shows almost nothing. Read the rendered pixel instead of trusting the hex:

```js
const gl = view3D.renderer.getContext(), px = new Uint8Array(4);
view3D.renderer.render(view3D.scene, view3D.camera);
gl.readPixels(sx, canvas.height - sy, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
```

Sample a point where the field is genuinely frontmost, or the pixel read
belongs to whatever occludes it. A colour change measured ~31 units of RGB
distance; the same strength as emissive glow measured 14 and was invisible.

### Animations in a headless or background pane

`requestAnimationFrame` may not fire at all in an automated preview pane even
when `document.hidden` is false, which leaves a move stuck mid-animation and
`isMoveInProgress` true — it looks exactly like a hung game but is not. Shim
it before driving a move in a test:

```js
window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
```
