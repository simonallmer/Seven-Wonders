# Great Wall

Game design: Simon Allmer. Internal rules reference for Seven Wonders, Version 2.

## Overview

Warriors with shields and bows on the walk of the wall. Facing matters: arrows glance off shields and fly on.

## Goal

Bring the rival army below four warriors.

## Players

2 or 4.

## Board and pieces

- The walk of the wall, with a Legendary Field for each army at its end (White's in the east, Black's in the west).
- 10 warriors per player. A warrior faces one of eight directions; his shield covers his back and both rear flanks.

## Setup

The wall is empty; all warriors are in reserve. White begins.

## Turn

Do one of four things: Place, Move, Shoot or Spin.

## Movement

- **Place:** set a warrior from reserve on a field of your supply, facing as you choose.
- **Move:** walk one warrior up to two fields in any direction, then choose his facing. A walk of two needs an empty field between. He may also stand still and only turn.
- **Supply chain:** begins on your Legendary Field and runs on through your warriors, each within two fields of the last (a gap of two needs a field between that no rival holds). You may place on any empty field within such a step of the chain.
- **Cut:** while a rival stands on your Legendary Field you cannot place.

## Attacks and captures

- **Shoot:** one warrior looses an arrow the way he faces. It flies until it meets a warrior.
- An arrow that strikes a warrior where his shield does not cover him fells him and flies on in the direction he was facing. On the back of a shield it flies straight back; on a rear flank it glances off by a quarter turn.
- Arrows do not know friend from foe. A warrior shot from the front sends the arrow back at the archer.
- **Spin:** one warrior strikes all eight fields around him, then chooses a new facing. Every neighbour, friend or foe, whose shield does not cover that side falls.

## Special rules

The fallen never return.

## End of the game

- **Victory:** an army with fewer than four warriors, wall and reserve together, is beaten. So is an army that can do nothing on its turn.
- **Draw:** the same position a third time.

## Four players

Two walls cross. White holds the south arm, Red the west, Black the north, Blue the east, each with a Legendary Field at its tip. Turn order White, Red, Black, Blue. A beaten army leaves the wall; the last one standing wins.

## Implementation notes

- Authority: old `great_wall-game.js` (2 players) and `great_wall4-game.js` (cross board).
- Kept quirk, not yet confirmed by Simon: a warrior shot from the front falls and the arrow returns to the archer.
- Code: `src/greatwall/rules.js`.
