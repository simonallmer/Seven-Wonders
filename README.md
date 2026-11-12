# Seven Wonders — Version 2

The abstract strategy games by Simon Allmer, presented on a table inside the Crystal Palace.
Static site, no build step and no server: open `index.html` through any web server, or host the folder on GitHub Pages.

    python3 -m http.server 8777     # then http://localhost:8777

On a Mac, double-click `Play Seven Wonders.command` instead: it starts that server and opens the game.
Opening `index.html` directly (`file://`) cannot work — browsers block modules and workers there.

## Layout

    index.html            page, HUD markup, import map
    css/style.css         HUD and overlays
    assets/               display font and symbols
    vendor/three/         three.js r160 (MIT), vendored so the site is self-contained
    src/main.js           app: states (intro → menu → travel → game), input, camera walk, transitions
    src/render.js         renderer, cross-fade between the two worlds, bloom, colour grade
    src/daylight.js       time of day from the visitor's clock; sky shader shared by every world
    src/palace.js         the Crystal Palace hall, the table, miniatures and memorabilia
    src/models.js         the fourteen miniatures and shared props (sphinx, obelisk, palm)
    src/textures.js       procedural textures (sand, limestone, wood, marble …)
    src/audio.js          synthesised sound effects and ambience (Web Audio, no files)
    src/fx.js             tweens, particles, small mesh helpers, mergeByMaterial (bakes static meshes to cut draw calls)
    src/wonders.js        the list of wonders shown on the table
    src/pyramid/          the Pyramid game: rules.js (pure), ai.js + ai-worker.js, scene.js, game.js
    src/gardens/          the Gardens game, same five files (two players)
    src/temple/           the Temple game, same five files (two or four players)
    src/statue/           the Statue game, same five files (two or four players)
    src/mausoleum/        the Mausoleum game, same five files (two or four players)
    src/colossus/         the Colossus game, same five files (two or four players)
    src/pharos/           the Pharos game, same five files (two or four players)
    src/greatwall/        the Great Wall game, same five files (two or four players)
    src/skyscraper/       the Skyscraper game, same five files (two or four players)
    test-rules.mjs        `node test-rules.mjs` — rules checks and AI self-play

## Adding the next wonder

1. Write `src/<wonder>/rules.js` (pure, with checks in `test-rules.mjs`), `ai.js` + `ai-worker.js`, `scene.js` and `game.js`.
   The world needs `scene`, `tweens`, `setBoard`, `pick`, `update`, `applyDaylight`, `homeView`, `cameraLimits`, and may set `ambience`, `veil`, `storm`, `shake`.
   The game needs `newGame(settings)`, `setActive`, `seatsChanged`, `refresh`, `click`, `hot`, `state.nPlayers`, `state.ply`, `over`; it reports to the HUD with `update({ order, turn, score, out, thinking })`.
2. Add it to `GAMES` and `RULES` in `src/main.js` (player counts, Standard/Conquest switch, sigil) and set `playable: true` in `src/wonders.js`. Worlds are built the first time their wonder is focused.
   A game may call `hud.action(label, fn)` — or `hud.action([{ label, fn }, …])` for several — to show buttons above the status line (Statue's Diminish, Great Wall's Shoot / Spin / Turn), and `hud.action(null)` to take them away.
   Anything tall that would hide the board (Zeus, the lighthouse, the temple roof, the Chrysler crown) is a `Lift` from `src/fx.js`: shown while the visitor arrives, raised by `world.reveal(false)` when the game becomes active.
3. In `src/palace.js`, build the miniature from the wonder's own `buildBoard({ mini: true })` and store `wonders[i].mini = { scale, origin }`; `diveView(index, home)` then lands the camera exactly on the real board. Add memorabilia and a rules sheet with `userData.pick = { type: 'rules', index }`.
4. Bake static scenery with `mergeByMaterial` — Gardens went from about 1,460 to 290 draw calls that way.

## Handy

- `?skip` skips the title, `?skip&play` goes straight into Pyramid, `?skip&play=gardens`, `=temple`, `=statue`, `=mausoleum`, `=colossus`, `=pharos`, `=greatWall` or `=skyscraper` into another wonder, `?hour=18.5` pins the clock.
- Keys: ← → walk the table · Enter play · R rules · L light (Live/Dawn/Noon/Dusk/Night) · M mute · Esc back.
- Console: `sevenWonders.advance(seconds)` steps the simulation (useful when the tab is throttled).
