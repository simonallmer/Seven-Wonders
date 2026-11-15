# Mausoleum

Game design: Simon Allmer. Internal rules reference for Seven Wonders, Version 2.

## Overview

Stones glide across a floor of six-sided slabs. An encircled stone falls and takes its slab with it, leaving a pit.

## Goal

Reduce your rival to fewer than four stones, or leave them no move.

## Players

2 or 4.

## Board and pieces

- A network of hexagonal slabs; from every slab lines run in six directions.
- 2 players: 9 stones each. 4 players: a longer floor, 8 stones each.

## Setup

Each player's stones fill the two rows nearest to them (4 players: one corner each). White begins.

## Turn

Move one of your stones: Glide or Push.

## Movement

- **Glide:** slide in a straight line until a stone, a pit or the edge stops you. A gliding stone always goes as far as it can.
- **Push:** step onto the slab of a neighbouring stone (yours or a rival's) and shove it one slab on along the same line. The slab behind must be free. A stone that was just pushed cannot be pushed again on the next turn. Nothing is pushed over the edge.
- **Trapped:** a stone with only one free slab beside it, or none, cannot move.

## Attacks and captures

- **Encircle:** a stone with no free slab beside it falls when more rival stones than friendly ones stand around it. The edge and the pits help to close the ring.
- **Collapse:** a fallen stone takes its slab with it. The pit stays for the rest of the game: nothing crosses it, and it walls in whoever stands beside it. One collapse may cause the next.
- **The pit:** a stone pushed into a pit is lost.

## Special rules

None beyond the above.

## End of the game

- **Victory:** a player with fewer than four stones has lost. So has a player who cannot move on their turn (entombed).
- **Draw:** the same position a third time.

## Four players

Turn order White, Red, Black, Blue. Every other colour is a rival, so two players can close a ring together. Whoever drops below four stones or is entombed is out, and their stones collapse into pits. The last one standing wins.

## Implementation notes

- Authority: old `mausoleum-game.js`.
- The 2-player board is turned so that White sits on the near side.
- Not yet confirmed by Simon: threefold repetition is a draw.
- Code: `src/mausoleum/rules.js`.
