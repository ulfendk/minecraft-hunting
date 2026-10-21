#!/usr/bin/env bash
# Smoke test: load the packs into a Bedrock Dedicated Server (Docker), summon
# every animal and fail if the content log reports errors.
# Usage: tools/bds-test.sh   (run `npm run build` first)
#
# When Safari Animals and/or Prehistoric Dinosaurs are built next to this checkout
# (../minecraft-safari-animals/build, ../minecraft-dinosaurs/build), their packs are loaded
# too and a few of their creatures must register as game and grade a heart shot perfect.
# HUNTING_COMPAT=0 turns that off; HUNTING_COMPAT=safari loads only the ones named.
set -euo pipefail

cd "$(dirname "$0")/.."
NAME=hunting-bds-test
DATA="$PWD/build/bds"
LEVEL=hunting_test
IMAGE=${BDS_IMAGE:-itzg/minecraft-bedrock-server:latest}
TIMEOUT=${BDS_TIMEOUT:-600}

uuid() { node -e "console.log(require('./build/$1/manifest.json').header.uuid)"; }
version() { node -e "console.log(JSON.stringify(require('./build/$1/manifest.json').header.version))"; }

docker rm -f "$NAME" >/dev/null 2>&1 || true
rm -rf "$DATA"
mkdir -p "$DATA/behavior_packs" "$DATA/resource_packs" "$DATA/worlds/$LEVEL"
cp -R build/behavior_pack "$DATA/behavior_packs/hunting_bp"
cp -R build/resource_pack "$DATA/resource_packs/hunting_rp"
bps="{\"pack_id\":\"$(uuid behavior_pack)\",\"version\":$(version behavior_pack)}"
rps="{\"pack_id\":\"$(uuid resource_pack)\",\"version\":$(version resource_pack)}"

# Other add-ons whose creatures register as game: "name bp-dir rp-dir targets..." (water creatures marked ~).
COMPAT=(
  "safari ../minecraft-safari-animals/build/behavior_pack ../minecraft-safari-animals/build/resource_pack safari:zebra safari:lion safari:elephant safari:gazelle ~safari:piranha"
  "dinosaurs ../minecraft-dinosaurs/build/dinosaurs_BP ../minecraft-dinosaurs/build/dinosaurs_RP dino:triceratops dino:tyrannosaurus dino:velociraptor ~dino:megalodon"
)
targets=""
if [[ "${HUNTING_COMPAT:-1}" != 0 ]]; then
  for c in "${COMPAT[@]}"; do
    read -r name bp rp rest <<< "$c"
    [[ -f "$bp/manifest.json" && -f "$rp/manifest.json" ]] || continue
    [[ "${HUNTING_COMPAT:-1}" == 1 || ",${HUNTING_COMPAT}," == *",$name,"* ]] || continue
    echo "Also loading $name"
    cp -R "$bp" "$DATA/behavior_packs/${name}_bp"
    cp -R "$rp" "$DATA/resource_packs/${name}_rp"
    m() { node -e "const h=require('$PWD/$1/manifest.json').header;console.log(JSON.stringify({pack_id:h.uuid,version:h.version}))"; }
    bps="$bps,$(m "$bp")"
    rps="$rps,$(m "$rp")"
    targets="$targets $rest"
  done
fi
echo "[$bps]" > "$DATA/worlds/$LEVEL/world_behavior_packs.json"
echo "[$rps]" > "$DATA/worlds/$LEVEL/world_resource_packs.json"

docker run -d --name "$NAME" --cap-add SYS_PTRACE \
  -e EULA=TRUE \
  -e LEVEL_NAME="$LEVEL" \
  -e LEVEL_TYPE=FLAT \
  -e GAMEMODE=creative \
  -e CONTENT_LOG_FILE_ENABLED=true \
  -e CONTENT_LOG_CONSOLE_OUTPUT_ENABLED=true \
  -e CONTENT_LOG_LEVEL=info \
  -v "$DATA:/data" \
  "$IMAGE" >/dev/null

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Waiting for server (timeout ${TIMEOUT}s)..."
start=$(date +%s)
until docker logs "$NAME" 2>&1 | grep -q "Server started"; do
  if ! docker ps -q -f name="$NAME" | grep -q .; then
    docker logs "$NAME" 2>&1 | tail -50
    echo "Server container exited early"; exit 1
  fi
  if (( $(date +%s) - start > TIMEOUT )); then
    docker logs "$NAME" 2>&1 | tail -50
    echo "Timed out waiting for server"; exit 1
  fi
  sleep 5
done

send() { docker exec -u 0 "$NAME" send-command "$@"; }
send tickingarea add circle 0 0 0 3 hunting_test true
sleep 5
# Summon in a 6-wide grid that stays inside the ticking area.
n=0
ids=""
for f in build/behavior_pack/entities/*.json; do
  id=$(basename "$f" .json)
  grep -q '"is_spawnable": false' "$f" && continue
  ids="$ids $id"
  x=$(( (n % 6) * 6 )); z=$(( (n / 6) * 6 ))
  # Water animals get a small pool so they don't suffocate before the check.
  y=-60
  if grep -qE '"breathes_air": false|minecraft:behavior.swim_up_for_breath' "$f"; then
    send fill $x -62 $z $((x + 2)) -60 $((z + 2)) water
    y=-61
  fi
  send summon "hunting:$id" $((x + 1)) $y $((z + 1))
  n=$((n + 1))
done
# The mini submarine in a pool of its own.
send fill 46 -62 40 49 -60 43 water
send summon hunting:mini_submarine 47 -61 41
ids="$ids mini_submarine"
send setblock 40 -60 40 hunting:camo_netting
send setblock 42 -60 40 hunting:tree_stand
send time set night
sleep 10
send time set day
sleep 10
# The scope zoom uses these; with no players online they must only report "No targets".
send camera @a fov_set 20 0.15
send camera @a fov_clear 0.15
send scriptevent hunting:selftest "$ids"
sleep 5
if [[ -n "$targets" ]]; then
  # One of each, far apart, out of the way of the grid (the test picks a calm adult).
  send tickingarea add -4 -64 56 200 0 64 hunting_compat true
  sleep 5
  n=0
  list=""
  for t in $targets; do
    id=${t#\~}
    x=$(( n * 24 )); z=60
    if [[ "$t" == ~* ]]; then
      send fill $((x - 2)) -63 $((z - 2)) $((x + 2)) -60 $((z + 2)) water
      send summon "$id" $x -62 $z 0 0 "${id%%:*}:spawn_adult"
    else
      send summon "$id" $x -60 $z 0 0 "${id%%:*}:spawn_adult"
    fi
    list="$list $id"
    n=$((n + 1))
  done
  sleep 8
  send scriptevent hunting:selftest_targets "$list"
  sleep 5
fi

LOG=$(docker logs "$NAME" 2>&1)
echo "$LOG" | grep -iE "hunting|error|warn|\[Scripting\]" | grep -vE "send-command|^\s*$" | tail -100 || true

if ! echo "$LOG" | grep -q "\[Realistic Hunting\] loaded"; then
  echo "FAIL: add-on script did not report loading"; exit 1
fi
if echo "$LOG" | grep -qiE "Unknown block|is not a valid block|Cannot place block"; then
  echo "FAIL: a custom block could not be placed"; exit 1
fi
if ! echo "$LOG" | grep -q "selftest PASS"; then
  echo "FAIL: self-test did not pass"; exit 1
fi
if [[ -n "$targets" ]] && ! echo "$LOG" | grep -q "target selftest PASS"; then
  echo "FAIL: other add-ons' creatures are not proper game"; exit 1
fi
if echo "$LOG" | grep -E "ERROR|\[error\]|Error\]" | grep -viE "Failed to connect|network|telemetry|No targets matched selector" | grep -q .; then
  echo "FAIL: content log has errors"; exit 1
fi
echo "PASS: Bedrock Dedicated Server loaded the packs without errors"
