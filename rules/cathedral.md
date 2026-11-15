# Cathedral

Game design: Simon Allmer. Internal rules reference for Seven Wonders, Version 2.

## Overview

"The Conversion." Stones walk the lines engraved in the floor of a cathedral. A stone that stops in front of a rival line turns the whole line to its own colour.

## Goal

Bring every other congregation below four stones.

## Players

2 or 4.

## Board and pieces

- A cross of five fields of 5 x 5 (a 15 x 15 square without its corners): 125 crossings.
- Lines run along rows and columns everywhere. Diagonals pass only through the strong crossings (column + row odd), marked with a rosette. The very middle is a weak crossing, entered on four lines ("Middle 4").
- Four passages: walkways outside the corners of the crossing, each joining the flank midpoints of two neighbouring arms: (5,2)-(2,5), (9,2)-(12,5), (12,9)-(9,12), (2,9)-(5,12).
- 15 stones per player.
- Walls, roofs, towers and the flèche stand while the visitor arrives and are lifted away for play.

## Setup

Each player's fifteen stones fill the three outer rows of their arm: White south, Black north, and with four players Red west and Blue east. White begins.

## Turn

Move one stone. If the move converts, the same stone may go on converting (a chain) or rest.

## Movement

- **Procession:** a stone moves along a line over empty fields, never jumping. It may go as many fields as the longest unbroken line of friendly stones standing directly beside it is long (the mover not counted). A lone stone always moves one field.
- **Passage:** crossing a walkway is a single plain step. Nothing is converted through it, and it cannot be part of a chain.

## Attacks and captures

- **Conversion (approach):** end a move directly in front of a rival's unbroken line that runs on in the direction of travel: the whole line takes the mover's colour. A line is stones of one colour; it ends where the colour changes, at an empty field, at the mover's own stone or at the edge.
- Conversion is never forced, but a move that ends in front of a rival line always converts it.
- **Chain:** after a conversion the same stone may move again, only to convert again, and never onto a field it has touched this turn. The player may rest at any time.
- Stones are never removed: they change colour.

## Special rules

- **Silence:** a congregation with fewer than four stones has lost. Its stones stay on the floor and can still be converted.
- **Pass:** a player who cannot move is passed over.

## End of the game

- **Victory:** the last congregation with four stones or more.
- If nobody can move, the largest congregation wins (a tie is a draw).
- **Draw:** the same position a third time.

## Four players

Turn order White, Red, Black, Blue. Converted stones fight on under their new colour. A silenced player is out; play goes on until one congregation remains.

## Implementation notes

- Authority: old `cathedral-game.js` with its default settings: conversion on approach only, field position "Middle 4".
- Not built: the old optional settings "Attack + Withdraw" (converting the line behind the starting field; it allowed endless jump-back loops) and "Middle 8" (the centre as a strong crossing).
- Not yet confirmed by Simon: threefold repetition is a draw; a chain is capped at eight conversions for the CPU's search.
- Two careful CPUs can circle each other for a long time; such games end as a draw by repetition or run long.
- Code: `src/cathedral/rules.js`.
