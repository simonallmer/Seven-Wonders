# Pyramid

Game design: Simon Allmer. Internal rules reference for Seven Wonders, Version 2.

## Overview

A race up a stepped pyramid. Stones run, climb and push; stones caught between two rivals are removed.

## Goal

Be the first to occupy the four victory fields at the corners of the top step.

## Players

2 or 4. Each seat can be a human or a CPU (Easy, Medium, Hard).

## Board and pieces

- A stepped pyramid seen from above: a square grid in which every field's step is its distance to the nearest edge.
- 2 players: 7 x 7 (steps of 7, 5 and 3, and the apex). 4 players: 9 x 9.
- The four victory fields are the corners of the top step, marked with a four-petal flower.
- 7 stones per player.

## Setup

Each player lines up seven stones along one edge of the bottom step, facing the opponent. White begins.

## Turn

Move one of your stones: Run, Jump or Push.

## Movement

- Stones never move diagonally and never share a field.
- **Run:** straight across any number of empty fields, along the step or down over its edge. Never upward.
- **Jump:** climb onto an empty adjacent field one step up.
- **Push:** take the place of an adjacent stone on your step and push it one field on. The field behind must be empty (never two stones). A pushed stone cannot push back on the next turn.

## Attacks and captures

- **Smash:** landing on an occupied field through a Run or a Push removes that stone; the landing stone takes its place.
- **Fall:** a stone pushed off the bottom step is removed.
- **Osiris:** stones enclosed in a straight line on one step by two opposing stones, with no gap, are removed.

## Special rules

- The apex field is playable.
- A player with fewer than four stones can no longer win. With four players they play on until only one rival still has four.

## End of the game

- **Victory:** stones on all four victory fields.
- **Attrition:** you also win as soon as every rival has fewer than four stones.
- **Draw:** no player has four stones left.

## Four players

One player per side of the pyramid; turn order White, Red, Black, Blue. Otherwise as above.

## Implementation notes

- Authority: the printed accordion rulebook (old folder `Rulebooks/`) plus the attrition win of the old Standard mode. The old Conquest mode (summit only) was cut in November 2026.
- Code: `src/pyramid/rules.js`.
