# Gardens

Game design: Simon Allmer. Internal rules reference for Seven Wonders, Version 2.

## Overview

A journey with towers of stones across two terraces. The stone on top commands a tower; staircases carry stones from the lower terrace to the upper one.

## Goal

Be the first to bring seven of your stones into your High Garden.

## Players

2. (The four-player board is not ported yet.)

## Board and pieces

- Two terraces, each a field of 3 x 5, and four gardens: a Home Garden and a High Garden at each end.
- White's High Garden lies above White's Home Garden, Black's above Black's.
- Two staircases: one from each Home Garden to the High Garden above it. The stairs in White's garden carry Black, the stairs in Black's garden carry White.
- 10 stones per player.

## Setup

Each player has ten stones in their Home Garden. White begins.

## Turn

Take one to five of your stones from a garden, or a whole tower with your stone on top, and walk with them. If you cannot move at all, Lift instead.

## Movement

- **The way:** lower field -> the rival's Home Garden -> up the staircase -> upper field -> your own High Garden.
- **Stride:** step from field to adjacent field, never diagonally and never back onto a field left in this move. On every field you enter, set down the lowest stone in your hand. You may stay and set down more stones on the same field.
- **Towers:** the top stone commands the tower and takes every stone beneath it along. A tower holds at most five stones; a full tower closes its field.
- **Gardens:** entering a garden ends the move; everything left in hand is set down there. You may enter both Home Gardens and your own High Garden. The rival's High Garden is reached by the staircase only. Stones in their own High Garden stay there.

## Attacks and captures

- **Capture:** set your stone on a rival's stone or tower and the tower is yours. Captured stones stay in the tower until it is moved or taken back.
- Stones in a garden cannot be captured.

## Special rules

- **Stairs:** after every turn, stones that outnumber the defenders of a Home Garden climb its staircase to the garden above. Only the surplus climbs (four against two send two); when the defenders leave, the rest follow.
- **Lift:** if you cannot move, choose a tower that holds your stones and lift them to the top. That is your whole turn.

## End of the game

**Victory:** seven stones in your High Garden.

## Four players

Not available in Version 2 yet.

## Implementation notes

- Authority: old `gardens-game.js` where deliberate, the rules text in old `gardens.html` otherwise.
- Lift as the whole turn: confirmed by Simon, 2026-11-10.
- CPU: captures are weighted high on purpose (a progress-first CPU lost clearly in self-play); entering the rival's garden is weighted above waiting for one more capture.
- Code: `src/gardens/rules.js`.
