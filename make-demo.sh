#!/bin/bash
# Builds the demo edition into "Seven Wonders Demo/" (its own git checkout of Seven-Wonders-Demo, ignored here).
# Run it after every change to the game, then commit and push both folders.
#   demo = this folder as it stands, with src/edition.js set to DEMO = true,
#          and the matches and computer players of the New Wonders taken out (their miniatures stay).
set -e
cd "$(dirname "$0")"
OUT="Seven Wonders Demo"
mkdir -p "$OUT"
rsync -a --delete \
  --exclude '.git' --exclude '.gitignore' --exclude '.DS_Store' --exclude '.claude' --exclude "$OUT" \
  --exclude 'instagram' --exclude 'rules' --exclude 'titles' --exclude 'test-rules.mjs' --exclude 'make-demo.sh' --exclude 'README.md' \
  ./ "$OUT/"

sed -i '' 's/export const DEMO = false;/export const DEMO = true;/' "$OUT/src/edition.js"
grep -q 'DEMO = true' "$OUT/src/edition.js"

# The New Wonders are not part of the demo: leave only what their miniatures need (scene and layout).
for id in colosseum greatwall library tower cathedral palace skyscraper; do
  dir="$OUT/src/$id"
  [ -f "$dir/game.js" ] || continue
  class=$(grep -o 'export class [A-Za-z]*Game' "$dir/game.js" | head -1 | awk '{print $3}')
  printf '// Not part of the demo.\nexport class %s {}\n' "$class" > "$dir/game.js"
  printf '// Not part of the demo.\nexport function chooseMove() { return null; }\n' > "$dir/ai.js"
  printf '// Not part of the demo.\n' > "$dir/ai-worker.js"
done

printf '.DS_Store\n' > "$OUT/.gitignore"
cat > "$OUT/README.md" <<'TXT'
# Seven Wonders · Demo

The demo of Seven Wonders by Simon Allmer: all seven Old Wonders, two players, the computer at its easy level, no time limit.
The New Seven Wonders, four-player games and the stronger computer players are part of Arcade:
[About Arcade](https://simonallmer.com/aboutarcade) · [Subscribe](https://simonallmer.com/subscribe)

This folder is generated from the full game by `make-demo.sh`. Do not edit it by hand.
TXT
echo "Demo built in: $OUT"
