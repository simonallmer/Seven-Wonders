# Temple

Game design: Simon Allmer. Internal rules reference for Seven Wonders, Version 2.

## Overview

A race across the temple floor along inlaid paths, with leaps over stones in the manner of draughts.

## Goal

Bring one of your stones to the Artemis field on the far side of the floor.

## Players

2 or 4.

## Board and pieces

- A mesh of fields joined along rows and columns; fields where row + column is even are also joined diagonally.
- 2 players: a long hexagon of 33 fields with an Artemis field at each tip.
- 4 players: a Greek cross of 61 fields with an Artemis field at each of the four tips.
- 9 stones per player.

## Setup

Each player's nine stones stand in the three lines nearest their own Artemis field. White begins.

## Turn

Move one stone: Walk, Leap (possibly a chain of leaps) or Leap of Faith.

## Movement

- A stone follows the paths and goes forwards or sideways, never back.
- **Walk:** step to an empty neighbouring field.
- **Leap:** over a neighbouring stone onto the empty field straight behind it. Never over two stones in a row.
- **Chain:** after a leap the same stone may leap again, turning by at most 45 degrees each time. You may stop after any leap.

## Attacks and captures

- A rival's stone you leap over is removed; your own stays.
- **Leap of Faith:** where the floor ends behind a rival's stone, you may leap over it and out of the temple. Both stones are removed.

## Special rules

**Pass:** a player who cannot move is passed over.

## End of the game

- **Victory:** a stone on the opposite Artemis field, or being the last player with stones on the floor.
- **Draw:** the same position a third time, or nobody can move.

## Four players

The floor is a cross with a tip for each player. Turn order White, Red, Black, Blue; each races to the opposite tip.

## Implementation notes

- Authority: old `temple-game.js`.
- Not yet confirmed by Simon: pass when stuck, last player with stones wins, threefold repetition is a draw.
- Code: `src/temple/rules.js`.
