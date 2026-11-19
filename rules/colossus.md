# Colossus

Game design: Simon Allmer. Internal rules reference for Seven Wonders, Version 2.

## Overview

The Colossus holds the board in his hands and tilts it. Stones run and push; whole groups without a free neighbour go to Hades.

## Goal

Reduce your rival to fewer than four stones.

## Players

2 or 4.

## Board and pieces

- A square with a short arm on each side. The middle field of each arm, marked with an arrow, is a direction field.
- 2 players: 12 stones each. 4 players: a larger board, 10 stones each.

## Setup

2 players: each player's stones stand in two opposite corners. 4 players: one corner each. White begins.

## Turn

Move one of your stones (Run or Push). Then the board tilts if a direction field is held, and any Hades is resolved.

## Movement

- Along rows and columns only.
- **Run:** straight over free fields, as far as you like. A stone never passes another.
- **Push:** take the place of a neighbouring stone (yours or a rival's) and shove it one field on. The field behind must be free. A stone that was just pushed is left alone for a turn, and no stone is shoved straight back the way it came.

## Attacks and captures

**Hades:** stones of one colour that touch along rows and columns form a group. A group with no free field beside it is removed, whoever it belongs to (the mover's own too). The edge closes a group in as well as stones do.

## Special rules

- **Tilt:** as long as a stone stands on a direction field, the board stays tilted that way: after every move, by any player, all stones slide toward that side until the edge or another stone stops them.
- **Balance:** two opposite direction fields held at once cancel each other. With two neighbouring ones held, a field just stepped onto tilts the board first, then the other one once. Two neighbouring fields held from before tilt it diagonally, toward the corner between them (each stone steps corner-wise while the field is free).
- A stone that slides onto a direction field tilts the board again at once.
- A Hades may form by a move or by a slide. Once it has, nothing slides further in that turn.

## End of the game

- **Victory:** a player with fewer than four stones has lost.
- **Draw:** the same position a third time.

## Four players

Turn order White, Red, Black, Blue. A player below four stones is out; their stones stay where they are. The last one remaining wins.

## Implementation notes

- Authority: old `colossus-game.js` for Run, Push and Hades.
- Tilt follows the old `resolveGravity()` (archive `Seven Wonders 2026.11.09/colossus-game.js`), confirmed by Simon in November 2026: held fields tilt after every move, opposite ones cancel, a fresh field first and then the others once, two neighbouring held fields diagonally. Added in Version 2: a stone sliding onto a direction field tilts again (the old rules text says so; the old code did not).
- Code: `src/colossus/rules.js`.
