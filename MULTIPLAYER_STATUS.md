# 3–4 Player Mode — Rollout Tracker

Goal: every game gets a 3- and/or 4-player mode. Each typically needs a redesigned
field plus extended colors, turn order, and AI.

Player colors (reference, from skyscraper): P1 white, P2 red, P3 blue, P4 green.
Gardens uses P1 white, P2 black as its established pair — new players use a contrasting pair.

## Done
- [x] **pyramid** — 2–4
- [x] **skyscraper** — 2–4 (white/red/blue/green)
- [x] **colosseum** — 2–4
- [x] **library** — 2–4

## Needs 3/4-player mode
- [x] **gardens** — 2–4 players, with AI
      - [x] Step-pyramid 4-player board (2 lower terraces + raised 5×5 battle plaza, two-tone goal trees)
      - [x] Player-count selector in menu (2 = classic board, 4 = step-pyramid), skyscraper-style
      - [x] Recessed staircases cut into the plaza (gentle, no z-fighting) + grounded arches + colour-coded waterfalls
      - [x] Centred palms; shared high gardens render each owner's stones on opposite halves
      - [x] Data model: bottom (front) / back / 5×5 plaza + 4 home + 2 shared high gardens, 4 colours
      - [x] Clockwise rules: adjacency, colour-locked staircase bridges, garden entry, capture, win at 7-of-your-own
      - [x] Turn order white→black→blue→red; AI controls every non-white player (Opponent: Computer)
      - Notes: AI is greedy-heuristic with emergency-lift; left/right battles are somewhat separate (corners feed
        their own goal column) — could force more central conflict if desired. 2p white/black clockwise swap still deferred.
- [x] **colossus** — 2 & 4 players, with AI
      - [x] Nearer start camera; per-mode camera framing (scales with board size)
      - [x] 4-player on expanded 11×11 core (13×13 cross); 2-player keeps 9×9 core
      - [x] 10 stones per player in one triangular corner; colours white(TL)/red(TR)/black(BR)/blue(BL)
      - [x] Clockwise turn order white→red→black→blue (from Pyramid); eliminate below 4, last standing wins
      - [x] Player-count selector in menu; AI controls every non-white player
- [ ] cathedral
- [ ] basilica
- [ ] great_wall
- [ ] mausoleum (currently shows "3 & 4 Player Mode: Coming Soon")
- [ ] pagoda
- [ ] palace
- [ ] pharos
- [ ] statue
- [ ] temple
- [ ] tower
