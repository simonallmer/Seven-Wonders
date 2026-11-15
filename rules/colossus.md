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

- **Tilt:** while a stone stands on a direction field, the board leans that way after every move: all stones slide toward that side until the edge or another stone stops them.
- **Balance:** two opposite direction fields held at once cancel each other. With two neighbouring ones held, the board leans to each in turn, the one just stepped onto first, until nothing slides any more.
- A Hades may form by a move or by a slide. Once it has, nothing slides further in that turn.

## End of the game

- **Victory:** a player with fewer than four stones has lost.
- **Draw:** the same position a third time.

## Four players

Turn order White, Red, Black, Blue. A player below four stones is out; their stones stay where they are. The last one remaining wins.

## Implementation notes

- Authority: old `colossus-game.js` for Run, Push and Hades.
- The tilt rule is a tidy version written for Version 2 because old code and old rules text disagreed (no diagonal slide, no player choice). Not yet confirmed by Simon.
- Code: `src/colossus/rules.js`.
