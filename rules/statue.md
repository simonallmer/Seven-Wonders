# Statue

Game design: Simon Allmer. Internal rules reference for Seven Wonders, Version 2.

## Overview

The stones are dice on the floor beneath the throne of Zeus. A die walks as far as it shows and grows with every move.

## Goal

Reduce your rival to fewer than four dice.

## Players

2 or 4.

## Board and pieces

- A floor of 11 x 11 fields. The four feet of the throne each take 2 x 2 fields out of it; defeated dice are stored in these four hollows.
- 4 players: two floors joined along one row (11 x 21), a throne on each.
- 8 dice per player.
- The statue (Zeus on his throne, on a plinth over the middle 5 x 5) is lifted away for the regular game.

## Setup

All dice start in reserve beside the floor. The floor is empty. White begins.

## Turn

Do one of three things: Place, Stride or Diminish. Placing is possible on every turn as long as dice are left in reserve.

## Movement

- **Place:** set a die from your reserve on any empty field. It shows 1.
- **Stride:** move one die as many single steps as it shows, along rows and columns, turning freely. It must take all its steps unless it can no longer move. Then it grows by one; a 6 that has moved becomes a 1.
- **Diminish:** lower one of your dice above 1 by one pip. The rival must then spend their turn striding with a die that shows 1. Only allowed if they have such a die and it can move.

## Attacks and captures

- **Strike:** a die that steps onto a rival's die removes it and walks on. It may strike several times in one stride.
- **Ones:** a die showing 1 cannot be struck and cannot be stepped onto.
- Your own dice block the way.

## Special rules

A forced move after a Diminish uses up the forced player's turn; play then continues with the next player after them.

## End of the game

- **Victory:** a player with fewer than four dice, floor and reserve together, has lost.
- **Draw:** nobody can move.

## Four players

Every player holds a quarter. Turn order White, Red, Black, Blue. You place only in your own quarter and never on the joining row, but stride and strike anywhere. A player below four dice is out and their dice leave the floor; the last one remaining wins. When you Diminish, you choose which rival must move.

## Implementation notes

- Authority: the 3D click handler in old `statue-game.js` (a stride is single steps with free turns, striking along the way).
- Not yet confirmed by Simon: the step-by-step stride; loss counting floor + reserve.
- Planned for special editions, not built: the statue as a 5 x 5 blocker that can be placed on the field ring or a corner, perhaps pushed.
- Code: `src/statue/rules.js`.
