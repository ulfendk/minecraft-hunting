# Realistic Hunting

A Minecraft **Bedrock Edition** add-on and **Java Edition** (Fabric) mod for realistic hunting, in the spirit of Hunting Simulator 2: game that sees, hears and smells you, scoped rifles with bullet drop and wind, spearfishing with harpoons, dive gear and a mini submarine, and an x-ray shot report showing exactly where your shot hit and which organs it went through.

**Download and info: https://ulfendk.github.io/minecraft-hunting/** (på dansk: https://ulfendk.github.io/minecraft-hunting/da/)

![White-tailed deer](https://ulfendk.github.io/minecraft-hunting/img/animals/white_tailed_deer.png)

## Features
- **15 game species:** white-tailed deer, red deer, roe deer, moose, wild boar, black bear, grey wolf, red fox, hare, pheasant, mallard and wild turkey on land; sea bass, bluefin tuna and porbeagle shark in the sea. Each has its own model, animations, sounds, babies and male/female looks (antlers, plumage).
- **Senses:** animals spot movement in their field of view and hear sprinting, jumping and shots. Downwind of you they smell you. Once they notice you they freeze with their heads up; push it and they bolt, taking the herd with them.
- **Wind:** it slowly turns and gusts. A wind checker shows it, it carries your scent, and it drifts long shots and arrows.
- **Scoped rifles:** .243, .308, .30-06 and .338 Magnum.
  - Right-click to raise the scope; tap sneak (or Z on Java) for 2×, 5× and 9×.
  - Hold sneak to steady your aim and hold your breath, but not for too long.
  - Each scope is zeroed at 100 m and has holdover marks for that calibre.
  - Bullets drop and drift on a real trajectory and lose energy with distance.
- **Shotgun and compound bow:** birdshot for birds and hares; broadheads that kill by bleeding.
- **Hit zones and the shot report:** every shot is traced against the animal's actual shape and the organs inside it: brain, spine, heart, lungs, liver, stomach, shoulders, hindquarters, legs. The report then shows:
  - an x-ray of the animal
  - distance and energy at impact
  - entry and exit
  - damage to each organ
  - accuracy, and a perfect, good, poor or unethical grade
  - whether it dropped, is mortally hit (and how far it will run), or only wounded

  Too light a calibre for the animal is flagged.
- **Spearfishing:** firearms don't work under water, so hunt fish with a **speargun** (hold use to pull back the bands, use again to fire) or a **hand harpoon** (hold use and let go to throw; pick it up again where it lands). Both keep their speed under water but are slow and weak through the air.
  - A speared fish is **on the line**: hold sneak to reel it in, and use the weapon again to let go. Big fish fight; keep the line too tight for too long and it snaps.
  - Fish have gills instead of lungs in the hit zones, and a dead fish floats up.
  - The **dive knife** cuts harder under water and field dresses like the hunting knife.
  - A **snorkel** lets you breathe just under the surface. A **dive mask** with a **scuba tank** lets you breathe anywhere under water until the tank (15 minutes) is empty; it fills up again at the surface. **Dive fins** make you swim faster (Java).
- **Mini submarine:** a one-seat sub for deep water. Move forward to go where you look, jump to rise (on Java the dive key, V, sinks). It runs on a battery that redstone charges; when it is flat, the sub floats up. The pilot breathes and sees clearly, the lamps come on in the deep, and using harpoon bolts fires the launcher in the nose, whose winch reels the fish in. Hit it to break it back into an item, like a boat.
- **Tracking:** wounded animals leave a blood trail; the kind of blood tells you what you hit. A shot animal becomes a carcass you field dress with a hunting knife for meat, hide and a trophy scored by size and shot quality.
- **Hunting dog:** tame a pointer with venison. Blow a dog whistle and it follows the trail to wounded or downed game and fetches shot birds.
- **Gear:**
  - binoculars with a range finder
  - deer, duck and predator calls
  - scent eliminator
  - ghillie suit
  - camouflage netting to build a hide
  - tree stands
- **Hunting Journal:** your shot reports, trophy log and a guide to the game you've seen.

## Install
1. Download `RealisticHunting.mcaddon` from the [latest release](https://github.com/ulfendk/minecraft-hunting/releases/latest).
2. Open it on Windows, Android or iOS. Minecraft imports both packs.
3. In your world settings, turn on **Realistic Hunting** under *Behavior Packs*.

Requires Minecraft Bedrock 1.21.90 or newer.

### Java Edition
1. Install [Fabric Loader](https://fabricmc.net/use/installer/) for Minecraft 26.3.
2. Download `hunting-fabric-<version>.jar` from the [latest release](https://github.com/ulfendk/minecraft-hunting/releases/latest), plus [Fabric API](https://modrinth.com/mod/fabric-api) and [GeckoLib](https://modrinth.com/mod/geckolib).
3. Put all three in your `mods` folder.

On Java, hold right-click to aim and left-click to fire. Press R for the full report of your last shot. In the mini submarine, V dives and G switches the lamps off and on (both can be rebound).

## Development
Everything is generated from code: models, textures, animations, hit zones and x-ray images all come from the specs in `src/animals/`.

```sh
npm ci
npm run build      # writes build/behavior_pack and build/resource_pack (and the Java resources)
npm run validate   # static checks, mostly for the resource pack
node tools/check-hitzones.mjs   # fires test shots at every species' hit model
npm run preview    # renders every animal to build/preview/*.png
npm run package    # dist/*.mcaddon and *.mcpack
npm run site       # the website, in build/site/
npm run test:server  # loads the packs in a Bedrock Dedicated Server and fires a real traced shot (needs Docker)

cd java                       # Java edition (needs JDK 25; run `npm run build` first)
./gradlew build               # the Fabric mod jar in java/build/libs, plus the game tests
./gradlew runGameTest         # server-side game tests (including JS/Java parity of hit zones and ballistics)
./gradlew runClientGameTest   # starts a client and screenshots the animals, the scope and a shot report
./gradlew runClient           # play it
```

The hunting logic runs in both editions:
- Bedrock: `src/packs/behavior_pack/scripts/`
- Java: `java/src/main/java/dk/ulfen/hunting/hunt/`

The ballistics and hit-zone code is shared on the JavaScript side (`scripts/lib/`). The build writes test vectors from it, and the Java game tests check the Java port gives identical results.

| Path | What it is |
| --- | --- |
| `src/animals/*.mjs` | One file per animal: stats, senses, hunting data, model, organs, texture recipe and animations |
| `src/lib/` | Generators: model + UV packing, procedural textures, animations, entity JSON, hit models |
| `src/zones.mjs`, `src/weapons.mjs` | Hit zones (what each organ does), calibres, firearms and harpoons |
| `src/diving.mjs`, `src/submarine.mjs` | Dive gear and the mini submarine (model, stats) |
| `src/packs/` | Hand-written pack files, including the Script API code in `behavior_pack/scripts/` |
| `src/items.mjs`, `src/blocks.mjs` | Gear, food, trophies, hides and blocks |
| `tools/` | Build, validation, x-ray and scope art, preview renderer, packaging, website, server test, Java resources |
| `java/` | The Fabric mod (Java edition) |

### Adding a species
1. Copy a similar spec in `src/animals/`. The body builders help: `cervid()` and `fishBody()` in `src/lib/bodies.mjs`, `mammal()` and friends in `src/lib/mammals.mjs`, and `gamebird()` in `src/lib/birds.mjs`. They also return the organ boxes.
2. Run `npm run preview <id>` and look at `build/preview/<id>.png`.
3. Run `node tools/check-hitzones.mjs <id>`.
4. Add a line to `src/guide.mjs` and the Danish names to `src/i18n.mjs` and `src/lang.mjs`.

### Releases
Bump `version` in `package.json`, add a section to `CHANGELOG.md`, then push a tag such as `v0.2.0`. The release workflow builds and tests the packs, publishes a GitHub Release with the files, and updates the website.

## License
MIT. Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.
