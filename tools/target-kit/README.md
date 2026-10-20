# Hunting target kit

Lets another add-on make its creatures game for Realistic Hunting. The add-on builds a
profile for each creature (game data and a hit model made from its own geometry) and
sends it to us. There's no build-time link between the add-ons; this kit is copied into
the other add-on, and each copy records which commit it came from.

| File | What it is |
| --- | --- |
| `src/lib/hitmodel.mjs` | `buildHitModel(spec)` plus organ helpers (`torsoOrgans`, `neckOrgans`, `headOrgans`, `fishOrgans`) |
| `src/zones.mjs` | Hit zones and their priority |
| `src/packs/behavior_pack/scripts/lib/hitzones.js` | `evaluate()`, the shot model, which `check.mjs` uses |
| `src/packs/behavior_pack/scripts/lib/protocol.js` | Profile format version, script-event chunking, `profileProblems()` |
| `tools/target-kit/check.mjs` | `checkProfile(profile)` for the other add-on's build: a broadside heart shot must grade perfect, and so on |

The protocol itself is described in the README under "Hunting targets for other add-ons".
