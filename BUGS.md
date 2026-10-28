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

### Y-1 — valid destinations resolve to the wrong field — **open**

Each tier overhangs the ring below it, so from the default camera the middle
of a destination field is hidden behind the tier in front of it and a click
aimed at its centre lands on the wrong square. This is almost certainly the
"it didn't register movements that should be possible" report, and also the
"pushed a stone from the top and it weirdly went all the way down" one — see
the second measurement below.

- Repro: start a game, select a front-row white stone, click the middle of
  any marked destination on the left rim. Most clicks deselect instead of
  moving.
- Measured (footprint): sampling a 5x5 grid over each destination, 36–48% of
  points resolve to the intended field.
- Measured (centres): with a single white stone on level 2, the eight run
  destinations plus the jump were each aimed at dead centre. 5 of 9 resolved
  to a different square, and the error is systematic — one tier off, onto
  whatever occludes the target. Aiming at the near `2,0,0` resolved to the
  apex `3,0,0`; aiming at `0,3,0` resolved to `1,2,0`; aiming at `1,2,0`
  resolved to the stone's own square, i.e. a deselect.
- Why that reads as "it went all the way down": RUN is a straight line down
  the slope, so one stone on level 2 offers three destinations in the same
  direction — `2,0,0`, `1,0,1`, `0,0,2`. Those are stacked in screen space,
  the lower ones in front. A click meant for the near one lands on a far one,
  and the stone runs to the bottom. The move logic is correct here: a push
  over the edge was verified to drop exactly one level (`2,1,0` pushing
  `2,2,0` lands it on `1,4,1`), and the cascade is the documented rule.
- A fix was written and then reverted on request, together with the hover
  highlighting it shipped alongside — see Y-5. If it is reinstated it should
  go in on its own: `pickTarget()` resolving an already-offered field ahead
  of whatever occludes it took all sampled destinations to 100%, changes
  nothing visually, and adds no UI.

### Y-5 — hover highlight turned stones permanently red — **reverted**

A hover highlight tinted the destination field white, or the field and its
victim red for a killing move. In play, stones stayed red permanently, which
is worse than cosmetic: red is a real player colour in 4-player mode.

Cause: stone materials are shared — 14 stones carry 28 material instances
across 42 material-bearing children, so the gold rim and body materials are
reused between stones. The tint saved "the original colour" per call and
pushed onto a restore list, so a second tint of an already-tinted shared
material recorded red as the original, and restoring put red back. Tinting
one stone also reached every stone sharing that material.

It was also simply too much: the board already marks destinations with rings,
so lighting them up as well was redundant. Reverted whole, along with the
Hints toggle that switched it. Any future version should settle what marks a
move — rings or lighting, not both — and must clone a material before
touching it.

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

At 1024x768 the 2-player menu's content is 882px against a 768px panel, so it
overflows by 114px and the Close button's bottom sits at 842px, below the
fold; Reset only just fits, at 766px. The panel scrolls (`overflow-y: auto`
when open) and both are reachable after scrolling, but there is no visual
scroll affordance.

Fixing it properly means a compaction pass on `.menu-content` (padding
`80px 24px 40px`, `gap: 24px`), in the spirit of the existing
`.side-menu.four-players` rules, rather than a one-value tweak. Y-3 takes most
of the sting out of it: the toggle at the top is now always reachable, so
nobody has to scroll to a Close button to shut the menu.

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
