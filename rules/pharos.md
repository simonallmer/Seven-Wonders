# Pharos

Game design: Simon Allmer. Internal rules reference for Seven Wonders, Version 2.

## Overview

Stones cannot move by themselves: they move on light sent by other stones of their colour, and by the beacons of the fortress.

## Goal

Leave your rival unable to move a single stone.

## Players

2 or 4.

## Board and pieces

- The board is the fortress: a square of fields with five beacons, one on each corner and the lighthouse over the middle.
- 2 players: 10 stones each. 4 players: a larger board, 7 stones each.

## Setup

White's stones stand in the two end rows, Black's in the two side columns (4 players: one edge each). All beacons are unlit. White begins.

## Turn

Move one stone, at least one step, paying for every step with a different light.

## Movement

- **Light:** a stone moves when another stone of its colour in the same row or column sends it light. A stone cannot light itself.
- **Sight:** light passes over empty fields and over your own stones. A rival's stone in between cuts it off.
- **Spent:** every stone has one light per turn.
- **Step:** one field along a row or column for every light received. Several steps are allowed, each paid by a different light; the stone may stop after any step.
- Your own stones block the way.

## Attacks and captures

Step onto a rival's stone to remove it. A stone may strike several times in one turn.

## Special rules

- **Kindle:** a stone that steps under a beacon lights it in its colour. It burns in that colour until a rival's stone steps under it.
- **Beacon light:** a lit beacon gives one more light each turn to any stone of its colour in its row or column. No stone can cut this light off. It does not light the stone standing under it.

## End of the game

- **Victory:** a player who cannot move any stone on their turn has lost.
- **Draw:** the same position a third time.

## Four players

Turn order White, Red, Black, Blue. Opposite edges are allies: they give each other light and do not strike each other. A player who cannot move is out and their stones are removed. When only two allies are left the alliance ends. One player wins.

## Implementation notes

- Authority: the old rules text, not the old code, on two points: no self-light, and beacon light is unblockable and does not light the stone under the beacon.
- The player never picks light sources by hand: a path is legal when every step can be given a light of its own.
- Not yet confirmed by Simon: the two points above, the end of the alliance, threefold repetition as a draw.
- Code: `src/pharos/rules.js`.
