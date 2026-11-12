#!/bin/bash
# Double-click to play: starts a small local web server in this folder and opens the game.
cd "$(dirname "$0")"
PORT=8777
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT + 1)); done
(sleep 1; open "http://localhost:$PORT") &
echo "Seven Wonders is running at http://localhost:$PORT — close this window to stop."
python3 -m http.server $PORT
