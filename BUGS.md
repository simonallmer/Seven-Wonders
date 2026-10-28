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

### Y-3 — the side menu covered its own toggle — **fixed**

With `#side-menu` open, the menu panel (`z-index: 999`) sat over the top bar
(`z-index: 100`) and with it `#menu-toggle`, so a second click on the toggle
landed on `menu-content` and the menu stayed open. The toggle already animates
into an X when the menu opens, so it looked like a close button and did
nothing. (An earlier note here said Pyramid has no in-menu close button; that
was wrong — `#close-from-menu-btn`, labelled "Close", does close the menu, as
does clicking outside it. The toggle was dead, not the menu unclosable.)

- Repro: open the menu, then click the toggle again. Before the fix the hit
  test at the toggle's own centre returned `menu-content`; clicks 2 and 3 of a
  three-click sequence missed the toggle entirely and the menu stayed open.
- Fix: `.top-bar` 100 → 600 and `.side-menu` 999 → 500, so the bar sits above
  the panel. All other layers keep their relative order: game container 1,
  game message 100, menu 500, top bar 600, game-over 2000, rules 3000, and in
  the demo build the paywall overlay 1000 and timer badge 9999.
- Verified: toggle alternates open/closed over four real pointer clicks at
  375x812 and 1024x768, in both the full game and the demo; every menu button,
  the title, the counts and the back link remain hit-testable with the menu
  open; the rules modal, the game-over overlay, the demo paywall and the demo
  timer badge all still cover the raised bar.
- Note: every other game with a side menu ships the same stacking (top bar
  100/1500/5000 under side menu 999/2000/10000), so the toggle is dead while
  the menu is open in cathedral, colosseum, colossus, gardens, great_wall,
  library, mausoleum, palace, pharos, statue, temple and tower too. Only
  Pyramid was asked for and only Pyramid was changed.

### Y-4 — the side menu is taller than the viewport — **open** (low)

At 1024x768 the 2-player menu's content is 958px against a 768px panel, so it
overflows by 190px and the Reset and Close buttons sit below the fold. The
panel scrolls (`overflow-y: auto` when open) and both buttons are reachable
after scrolling, but there is no visual scroll affordance.

The Hints button added ~76px of this; before it the menu already overflowed by
~114px and Close was already below the fold. Fixing it properly means a
compaction pass on `.menu-content` (padding `80px 24px 40px`, `gap: 24px`),
in the spirit of the existing `.side-menu.four-players` rules, rather than a
one-value tweak. Y-3 takes most of the sting out of it: the toggle at the top
is now always reachable, so nobody has to scroll to a Close button to shut the
menu.

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

CSS transitions are throttled the same way, which is a separate trap: the side
menu's `.open` class applies but `transform` stays at `translateX(100%)`, so
hit tests against the "open" menu silently probe an off-screen panel. Disable
the transition before measuring geometry:

```js
sideMenu.style.transition = 'none';
sideMenu.classList.add('open');
sideMenu.getBoundingClientRect();   // force the reflow before hit-testing
```

Both traps make a working UI look broken. Confirm which you are looking at by
reading the computed `transform` or counting rAF callbacks before filing.
