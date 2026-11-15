# Skyscraper

Game design: Simon Allmer. Internal rules reference for Seven Wonders, Version 2.

## Overview

Players light the windows of the tower. A fully lit row of five goes to whoever holds most of it.

## Goal

Light more than your share of the windows: more than half with two players, more than a quarter with four.

## Players

2 or 4. (The old three-player option is not offered.)

## Board and pieces

- The outside of the tower, five windows wide on every side, and its roof. A block is one piece: a corner block has a window on two sides and counts twice; a block on the edge of the roof shows on the roof and on its side (two windows, three at a roof corner).
- 2 players: the five upper floors and the roof (125 windows, 63 needed). 4 players: all ten floors (225 windows, 57 needed).
- Seats are shown as light: warm white, violet (Black), red, blue.
- The crown of the building stays on while the roof is closed. When the elevator reaches the roof, the crown is lifted away and the elevator band disappears.
- The panel shows every player's windows against the number needed, and a bar of the whole tower with the leader first.

## Setup

Each player starts with one lit window in the middle of their side, on the lowest floor in play. White begins.

## Turn

Light one dark window.

## Movement

- The window must be in line with one of your own lit windows: on the same floor along the same side, straight above or below, or straight through the tower to the opposite side.
- **Shadow:** a rival's window between the two blocks the line. The inside of the tower does not.
- **Elevator:** you cannot light higher than the elevator has come. It starts one floor above the lowest and rises a floor every round, until the roof is open.

## Attacks and captures

- **Row:** when a row of five is fully lit (five along one side on one floor, five across the roof, or the five floors of one column), whoever has the most windows in it takes the whole row. A tie leaves it as it is.
- **Split:** a window may complete several rows at once. Each is judged on its own; the completing window stays yours if you won at least one of them.
- **Safe in the same turn:** when you take a row, the window you just lit cannot be lost in that turn, even if another row it completes goes to a rival.

## Special rules

**Pass:** a player who cannot light a window is passed over.

## End of the game

The game ends as soon as a player holds more than their share, or when nobody can light a window; then the player with the most windows wins.

## Four players

All ten floors are in play; turn order White, Red, Black, Blue. More than a quarter of the windows wins.

## Implementation notes

- Authority: old `skyscraper-game.js`.
- Windows are counted per face, as the old score did. Not yet confirmed by Simon.
- Code: `src/skyscraper/rules.js`.
