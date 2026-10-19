// Generates the Java edition's resources (java/src/generated/resources) from the
// same specs as the Bedrock packs. GeckoLib reads the Bedrock geometry and
// animation formats directly, so models and animations are shared as-is.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { NS } from '../src/lib/constants.mjs';
import { hitbox } from '../src/lib/behavior.mjs';
import { eggIcon } from '../src/lib/texture.mjs';
import { PNG } from 'pngjs';
import { evaluate } from '../src/packs/behavior_pack/scripts/lib/hitzones.js';
import { energyAt, pointAt, windAt } from '../src/packs/behavior_pack/scripts/lib/ballistics.js';

const BEDROCK_TO_JAVA_SOUNDS = {
  'mob.horse.donkey.idle': 'entity.donkey.ambient', 'mob.horse.donkey.hit': 'entity.donkey.hurt',
  'mob.horse.donkey.death': 'entity.donkey.death', 'mob.horse.eat': 'entity.horse.eat',
  'mob.goat.ambient': 'entity.goat.ambient', 'mob.goat.hurt': 'entity.goat.hurt', 'mob.goat.death': 'entity.goat.death',
  'mob.cow.say': 'entity.cow.ambient', 'mob.cow.hurt': 'entity.cow.hurt',
  'mob.pig.say': 'entity.pig.ambient', 'mob.pig.death': 'entity.pig.death',
  'mob.hoglin.hurt': 'entity.hoglin.hurt', 'mob.hoglin.ambient': 'entity.hoglin.ambient',
  'mob.hoglin.death': 'entity.hoglin.death', 'mob.hoglin.angry': 'entity.hoglin.angry',
  'mob.polarbear.warning': 'entity.polar_bear.warning', 'mob.polarbear.hurt': 'entity.polar_bear.hurt',
  'mob.polarbear.death': 'entity.polar_bear.death',
  'mob.cat.hiss': 'entity.cat.hiss', 'mob.cat.hit': 'entity.cat.hurt', 'mob.ocelot.death': 'entity.ocelot.death',
  'mob.cat.straymeow': 'entity.cat.stray_ambient',
  'mob.fox.screech': 'entity.fox.screech', 'mob.fox.ambient': 'entity.fox.ambient', 'mob.fox.hurt': 'entity.fox.hurt',
  'mob.fox.death': 'entity.fox.death', 'mob.fox.sniff': 'entity.fox.sniff',
  'mob.wolf.hurt': 'entity.wolf.hurt', 'mob.wolf.death': 'entity.wolf.death', 'mob.wolf.bark': 'entity.wolf.ambient',
  'mob.ravager.ambient': 'entity.ravager.ambient', 'mob.ravager.hurt': 'entity.ravager.hurt',
  'mob.ravager.death': 'entity.ravager.death', 'mob.ravager.roar': 'entity.ravager.roar',
  'mob.llama.idle': 'entity.llama.ambient', 'mob.llama.hurt': 'entity.llama.hurt', 'mob.llama.death': 'entity.llama.death',
  'mob.chicken.say': 'entity.chicken.ambient', 'mob.chicken.hurt': 'entity.chicken.hurt',
  'mob.parrot.idle': 'entity.parrot.ambient', 'mob.parrot.hurt': 'entity.parrot.hurt', 'mob.parrot.death': 'entity.parrot.death',
  'mob.phantom.idle': 'entity.phantom.ambient',
  'mob.turtle.ambient': 'entity.turtle.ambient_land', 'mob.turtle.hurt': 'entity.turtle.hurt', 'mob.turtle.death': 'entity.turtle.death',
  'mob.panda.idle': 'entity.panda.ambient', 'mob.panda.hurt': 'entity.panda.hurt', 'mob.panda.death': 'entity.panda.death',
  'mob.panda.idle.aggressive': 'entity.panda.aggressive_ambient',
  'mob.wolf.growl': 'entity.wolf.growl',
  'mob.armadillo.ambient': 'entity.armadillo.ambient', 'mob.armadillo.hurt': 'entity.armadillo.hurt', 'mob.armadillo.death': 'entity.armadillo.death',
  'mob.fish.hurt': 'entity.cod.hurt', 'mob.fish.death': 'entity.cod.death', 'mob.fish.flop': 'entity.cod.flop',
  'mob.guardian.ambient': 'entity.guardian.ambient', 'mob.guardian.hit': 'entity.guardian.hurt', 'mob.guardian.death': 'entity.guardian.death',
  'mob.dolphin.idle': 'entity.dolphin.ambient', 'mob.dolphin.hurt': 'entity.dolphin.hurt', 'mob.dolphin.death': 'entity.dolphin.death',
  'mob.spider.say': 'entity.spider.ambient', 'mob.spider.death': 'entity.spider.death',
  'mob.silverfish.say': 'entity.silverfish.ambient', 'mob.silverfish.hit': 'entity.silverfish.hurt', 'mob.silverfish.kill': 'entity.silverfish.death',
  'mob.camel.ambient': 'entity.camel.ambient', 'mob.camel.hurt': 'entity.camel.hurt', 'mob.camel.death': 'entity.camel.death',
  'mob.rabbit.idle': 'entity.rabbit.ambient', 'mob.rabbit.hurt': 'entity.rabbit.hurt', 'mob.rabbit.death': 'entity.rabbit.death',
  'mob.chicken.death': 'entity.chicken.death', 'mob.wolf.whine': 'entity.wolf.whine', 'mob.wolf.panting': 'entity.wolf.pant',
  'mob.polarbear.idle': 'entity.polar_bear.ambient', 'mob.goat.ambient.screamer': 'entity.goat.screaming.ambient',
  'mob.sheep.say': 'entity.sheep.ambient', 'mob.horse.idle': 'entity.horse.ambient', 'mob.horse.hit': 'entity.horse.hurt', 'mob.horse.death': 'entity.horse.death',
  'mob.horse.breathe': 'entity.horse.breathe', 'mob.horse.angry': 'entity.horse.angry',
  'mob.frog.ambient': 'entity.frog.ambient', 'mob.frog.hurt': 'entity.frog.hurt', 'mob.frog.death': 'entity.frog.death',
  'mob.sniffer.idle': 'entity.sniffer.idle', 'mob.sniffer.hurt': 'entity.sniffer.hurt', 'mob.sniffer.death': 'entity.sniffer.death',
};
const VANILLA_PREY = new Set(['pig', 'chicken', 'parrot', 'rabbit', 'sheep', 'cow', 'cod', 'salmon', 'tropical_fish']);
const ITEM_RENAMES = { deadbush: 'dead_bush' };

const javaItem = (id) => {
  const [ns, name] = id.includes(':') ? id.split(':') : ['minecraft', id];
  return `${ns}:${ITEM_RENAMES[name] ?? name}`;
};
const javaSound = (s) => {
  if (!s) return null;
  const j = BEDROCK_TO_JAVA_SOUNDS[s];
  if (!j) throw new Error(`No Java sound mapped for Bedrock sound "${s}" (tools/java.mjs)`);
  return `minecraft:${j}`;
};

async function write(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2) + '\n');
}

/** Turn the Bedrock-style hunting/flee families into concrete entity ids. */
function resolveTargets(families, animals) {
  const out = new Set();
  for (const f of families ?? []) {
    let matched = false;
    for (const a of animals) {
      if (a.id === f || (a.family ?? []).includes(f)) {
        out.add(`${NS}:${a.id}`);
        matched = true;
      }
    }
    if (VANILLA_PREY.has(f)) out.add(`minecraft:${f}`);
    else if (!matched && f === 'player') out.add('minecraft:player');
  }
  return [...out];
}

function hostileRule(a) {
  if (!a.hostile) return null;
  let when = 'always';
  for (const f of a.hostile.filters ?? []) {
    if (f.test === 'is_daytime') when = f.value ? 'day' : 'night';
    if (f.test === 'in_water' && f.subject === 'other') when = 'in_water';
  }
  if (when === 'in_water' && (a.hostile.filters ?? []).some((f) => f.test === 'actor_health')) when = 'in_water_hurt';
  return { range: a.hostile.range ?? 8, when };
}

/** Species data read by the Java mod at startup (dk.ulfen.hunting.species.Species). */
function speciesRecord(a, animals, animNames) {
  const s = a.sounds ?? {};
  return {
    id: a.id,
    kind: a.ride ? 'mount' : a.movement === 'swim' || a.movement === 'dolphin' ? 'swimmer' : 'animal',
    width: Math.round((hitbox(a)[0] / (a.scale ?? 1)) * 1000) / 1000,
    height: a.size[1],
    health: a.health,
    speed: a.speed,
    attackDamage: a.attack?.damage ?? 0,
    attackSpeed: a.attack?.speed ?? 1.3,
    leap: !!a.attack?.leap,
    knockbackResistance: a.knockbackResistance ?? 0,
    alertsPack: !!a.alertsPack,
    hunts: resolveTargets(a.hunts, animals),
    huntInterval: a.huntInterval ?? 30,
    huntRange: a.huntRange ?? 16,
    fleesFrom: resolveTargets(a.fleesFrom, animals),
    fleeDistance: a.fleeDistance ?? 12,
    fleeSpeed: a.fleeSpeed ?? 1.6,
    panicSpeed: a.panicSpeed ?? 1.5,
    hostile: hostileRule(a),
    sleeps: a.sleeps ?? 'night',
    movement: a.movement ?? 'walk',
    flySpeed: a.flySpeed ?? 0.15,
    swimSpeed: a.swimSpeed ?? 0.12,
    school: !!a.school,
    attackEffect: a.attack?.effect ?? null,
    variantTextures: (a.variants ?? []).map((v) => v.texture ?? null),
    climbs: !!a.climbs,
    fallImmune: !!a.fallImmune || a.movement === 'fly',
    grazes: !!a.grazes,
    wades: !!a.wades,
    breed: (a.breed ?? []).map(javaItem),
    tempt: (a.tempt ?? a.breed ?? []).map(javaItem),
    heal: (a.heal ?? []).map(([item, amount]) => ({ item: javaItem(item), amount })),
    variants: a.variants?.length ?? 0,
    babyScale: a.babyScale ?? 0.5,
    scale: a.scale ?? 1,
    ride: a.ride ? {
      seats: (a.ride.seats ?? [a.ride.seat]).length,
      seatHeight: (a.ride.seats ?? [a.ride.seat])[0][1],
      chest: !!a.ride.chest,
      jump: a.ride.jump !== false,
      jumpStrength: a.ride.jumpStrength ?? 0.5,
      tameItems: (a.ride.tameItems ?? []).map(javaItem),
      temper: a.ride.temper ?? 100,
    } : null,
    sounds: {
      ambient: javaSound(s.ambient), hurt: javaSound(s.hurt), death: javaSound(s.death),
      pitchMin: (s.pitch ?? [1, 1])[0], pitchMax: (s.pitch ?? [1, 1])[1], interval: s.interval ?? 10,
    },
    animations: animNames,
    idle: a.client?.idle ?? ['idle'],
    runSpeed: a.client?.runSpeed ?? 5,
    maleBones: a.maleBones ?? [],
    spawns: (a.spawn ?? []).map((sp) => ({ biomes: sp.biomes, weight: sp.weight ?? 5, min: sp.group?.[0] ?? 1, max: sp.group?.[1] ?? 1, water: !!sp.water, minY: sp.height?.[0] ?? -64, maxY: sp.height?.[1] ?? 320 })),
    egg: a.egg,
    companion: !!a.companion,
    game: a.game ? {
      gameClass: a.game.class, minEnergy: a.game.minEnergy, minShotEnergy: a.game.minShotEnergy ?? 4,
      weightMin: a.game.weight[0], weightMax: a.game.weight[1], score: a.game.score ?? 0,
      trophy: a.game.trophy ?? null, maleTrophy: !!a.game.maleTrophy, call: a.game.call ?? null,
    } : null,
    bird: a.movement === 'fly',
    senses: a.senses ?? null,
    // Gson can't read null into a JsonObject: leave these out when there are none.
    ...(a.hitModel ? { hitModel: a.hitModel } : {}),
    ...(a.hitModelFemale ? { hitModelFemale: a.hitModelFemale } : {}),
    xrayView: a.xrayView ?? null,
    xrayZones: a.xrayZones ?? [],
    loot: (a.loot ?? []).map((l) => ({ item: javaItem(l.item), min: l.min ?? 0, max: l.max ?? 1 })),
    warnSound: javaSound(s.warn ?? null),
  };
}

function lootTable(a) {
  return {
    type: 'minecraft:entity',
    pools: (a.loot ?? []).map((l) => ({
      rolls: 1,
      ...(l.chance ? { conditions: [{ condition: 'minecraft:random_chance', chance: l.chance }] } : {}),
      entries: [{
        type: 'minecraft:item',
        name: javaItem(l.item),
        functions: [
          { function: 'minecraft:set_count', count: { type: 'minecraft:uniform', min: l.min ?? 0, max: l.max ?? 1 } },
          ...(l.smelts ? [{ function: 'minecraft:furnace_smelt', conditions: [{ condition: 'minecraft:entity_properties', entity: 'this', predicate: { flags: { is_on_fire: true } } }] }] : []),
          { function: 'minecraft:enchanted_count_increase', enchantment: 'minecraft:looting', count: { type: 'minecraft:uniform', min: 0, max: 1 } },
        ],
      }],
    })),
  };
}

/** Bedrock recipe -> Java recipe (one or more files). */
function javaRecipes(recipe) {
  const [type, body] = Object.entries(recipe)[0];
  const name = body.description.identifier.split(':')[1];
  const result = (r) => ({ id: javaItem(r.item), count: r.count ?? 1 });
  if (type === 'minecraft:recipe_shaped') {
    return [[name, {
      type: 'minecraft:crafting_shaped',
      category: 'misc',
      pattern: body.pattern,
      key: Object.fromEntries(Object.entries(body.key).map(([k, v]) => [k, javaItem(v.item)])),
      result: result(body.result),
    }]];
  }
  if (type === 'minecraft:recipe_shapeless') {
    return [[name, {
      type: 'minecraft:crafting_shapeless',
      category: 'misc',
      ingredients: body.ingredients.flatMap((i) => Array.from({ length: i.count ?? 1 }, () => javaItem(i.item))),
      result: result(body.result),
    }]];
  }
  if (type === 'minecraft:recipe_furnace') {
    const base = { ingredient: javaItem(body.input), result: { id: javaItem(body.output) } };
    return [
      [name, { type: 'minecraft:smelting', category: 'food', ...base, experience: 0.35, cookingtime: 200 }],
      [`${name}_from_smoking`, { type: 'minecraft:smoking', category: 'food', ...base, experience: 0.35, cookingtime: 100 }],
      [`${name}_from_campfire`, { type: 'minecraft:campfire_cooking', category: 'food', ...base, experience: 0.35, cookingtime: 600 }],
    ];
  }
  throw new Error(`Unknown recipe type ${type}`);
}

/** Bedrock block geometry (per-face UV boxes and planes) -> Java block model elements. */
function blockModel(block) {
  const elements = [];
  for (const bone of block.geometry['minecraft:geometry'][0].bones) {
    for (const cube of bone.cubes) {
      const from = [cube.origin[0] + 8, cube.origin[1], cube.origin[2] + 8];
      const to = from.map((v, i) => v + cube.size[i]);
      const faces = {};
      const all = { north: 'north', south: 'south', east: 'east', west: 'west', up: 'up', down: 'down' };
      for (const f of Object.keys(cube.uv)) faces[all[f]] = { uv: [0, 0, 16, 16], texture: '#all' };
      const el = { from, to, faces };
      if (cube.rotation) {
        const axis = cube.rotation[1] ? 'y' : cube.rotation[0] ? 'x' : 'z';
        el.rotation = { origin: [8, 0, 8], axis, angle: cube.rotation[{ x: 0, y: 1, z: 2 }[axis]] };
      }
      elements.push(el);
    }
  }
  return { textures: { all: `${NS}:block/${block.id}`, particle: `${NS}:block/${block.id}` }, elements };
}

export async function buildJava({ animals, geos, anims, textures, items, blocks, recipes, projectiles, vehicles, langs, icon, xrays, armor, calibres, firearms, zones, priority, harpoons, line, knives, dive, submarine, OUT }) {
  const R = OUT;
  await rm(R, { recursive: true, force: true });
  const A = join(R, 'assets', NS);
  const D = join(R, 'data', NS);

  const species = [];
  for (const a of animals) {
    await write(join(A, 'geckolib', 'models', 'entity', `${a.id}.geo.json`), geos[a.id]);
    await write(join(A, 'geckolib', 'animations', 'entity', `${a.id}.animation.json`), anims[a.id]);
    await write(join(A, 'textures', 'entity', `${a.id}.png`), textures[a.id]);
    for (const v of a.variants ?? []) {
      if (v.texture) await write(join(A, 'textures', 'entity', `${a.id}_${v.texture}.png`), textures[`${a.id}_${v.texture}`]);
    }
    await write(join(A, 'textures', 'item', `${a.id}_spawn_egg.png`), eggIcon(a.egg[0], a.egg[1], a.id.length));
    await itemModel(A, `${a.id}_spawn_egg`, 'minecraft:item/generated');
    await write(join(D, 'loot_table', 'entities', `${a.id}.json`), lootTable(a));
    species.push(speciesRecord(a, animals, Object.keys(a.anims)));
  }
  await write(join(D, 'species.json'), species);

  // Thrown spear uses a GeckoLib model; pebbles and fruit render as flat items.
  for (const p of projectiles.filter((x) => x.rotate)) {
    await write(join(A, 'geckolib', 'models', 'entity', `${p.id}.geo.json`), geos[p.id]);
    await write(join(A, 'textures', 'entity', `${p.id}.png`), textures[p.id]);
    await write(join(A, 'geckolib', 'animations', 'entity', `${p.id}.animation.json`), { format_version: '1.8.0', animations: { [`animation.hunting.${p.id}.idle`]: { loop: true, bones: {} } } });
  }

  // The submarine: a GeckoLib model like the animals.
  for (const id of vehicles) {
    await write(join(A, 'geckolib', 'models', 'entity', `${id}.geo.json`), geos[id]);
    await write(join(A, 'geckolib', 'animations', 'entity', `${id}.animation.json`), anims[id]);
    await write(join(A, 'textures', 'entity', `${id}.png`), textures[id]);
  }

  for (const item of items) {
    await write(join(A, 'textures', 'item', `${item.id}.png`), item.icon);
    const handheld = /knife|rifle|shotgun|bow|harpoon|speargun/.test(item.id);
    const parent = handheld ? 'minecraft:item/handheld' : 'minecraft:item/generated';
    // Bedrock-only items (the loaded speargun) are only a model here: see the speargun below.
    if (item.bedrockOnly) await write(join(A, 'models', 'item', `${item.id}.json`), { parent, textures: { layer0: `${NS}:item/${item.id}` } });
    else await itemModel(A, item.id, parent);
  }
  // The speargun shows its bolt while loaded (Java keeps it in the charged-projectiles component).
  await write(join(A, 'items', 'speargun.json'), {
    model: {
      type: 'minecraft:select', property: 'minecraft:charge_type',
      cases: [{ when: 'arrow', model: { type: 'minecraft:model', model: `${NS}:item/speargun_loaded` } }],
      fallback: { type: 'minecraft:model', model: `${NS}:item/speargun` },
    },
  });
  // Every knife can field dress a carcass.
  await write(join(D, 'tags', 'item', 'knives.json'), { values: knives.map((k) => `${NS}:${k}`) });

  // Armour sets (ghillie suit, dive gear): vanilla-style armour layers.
  for (const [set, layers] of Object.entries(armor)) {
    await write(join(A, 'textures', 'entity', 'equipment', 'humanoid', `${set}.png`), layers[1]);
    await write(join(A, 'textures', 'entity', 'equipment', 'humanoid_leggings', `${set}.png`), layers[2]);
    await write(join(A, 'equipment', `${set}.json`), { layers: { humanoid: [{ texture: `${NS}:${set}` }], humanoid_leggings: [{ texture: `${NS}:${set}` }] } });
  }

  // X-ray images for the shot report screen.
  for (const [name, png] of Object.entries(xrays)) await write(join(A, 'textures', 'gui', 'xray', `${name}.png`), png);

  // Shared hunting data: zones, calibres, firearms, and test vectors computed by the
  // JavaScript implementation that the Java game tests compare against.
  await write(join(D, 'hunting.json'), { zones, priority, calibres, firearms, harpoons, line, dive, submarine });
  await write(join(D, 'test_vectors.json'), testVectors(animals, zones, priority, calibres));

  for (const block of blocks) {
    await write(join(A, 'textures', 'block', `${block.id}.png`), block.texture);
    await write(join(A, 'models', 'block', `${block.id}.json`), blockModel(block));
    await write(join(A, 'blockstates', `${block.id}.json`), { variants: { '': { model: `${NS}:block/${block.id}` } } });
    await write(join(A, 'models', 'item', `${block.id}.json`), { parent: `${NS}:block/${block.id}` });
    await write(join(A, 'items', `${block.id}.json`), { model: { type: 'minecraft:model', model: `${NS}:item/${block.id}` } });
    await write(join(D, 'loot_table', 'blocks', `${block.id}.json`), {
      type: 'minecraft:block',
      pools: [{ rolls: 1, entries: [{ type: 'minecraft:item', name: `${NS}:${block.id}` }], conditions: [{ condition: 'minecraft:survives_explosion' }] }],
    });
  }

  for (const recipe of recipes) for (const [name, body] of javaRecipes(recipe)) await write(join(D, 'recipe', `${name}.json`), body);

  // Language files: Bedrock keys -> Java keys.
  for (const [locale, entries] of Object.entries(langs)) {
    const out = {};
    for (const [k, v] of entries) {
      let m;
      if ((m = k.match(/^entity\.hunting:(.+)\.name$/))) out[`entity.${NS}.${m[1]}`] = v;
      else if ((m = k.match(/^item\.spawn_egg\.entity\.hunting:(.+)\.name$/))) out[`item.${NS}.${m[1]}_spawn_egg`] = v;
      else if ((m = k.match(/^item\.hunting:(.+)\.name$/))) out[`item.${NS}.${m[1]}`] = v;
      else if ((m = k.match(/^tile\.hunting:(.+)\.name$/))) out[`block.${NS}.${m[1]}`] = v;
      else if (k.startsWith('hunting.')) out[k] = v;
      else if (k.startsWith('action.interact.') || k.startsWith('key.')) out[k] = v;
    }
    out[`itemGroup.${NS}`] = locale === 'da_DK' ? 'Realistisk jagt' : 'Realistic Hunting';
    await write(join(A, 'lang', `${locale.toLowerCase()}.json`), out);
  }

  await write(join(A, 'icon.png'), icon);
  return species.length;
}

/** Shots and ballistics computed in JavaScript; HuntingGameTests checks the Java port agrees. */
function testVectors(animals, zones, priority, calibres) {
  const shots = [];
  for (const a of animals.filter((x) => x.game)) {
    const m = a.hitModel;
    const [min, max] = m.bounds;
    const k = a.scale ?? 1;
    // A fan of rays from the left side, from the front and quartering.
    for (let i = 0; i < 6; i++) {
      const y = min[1] + ((max[1] - min[1]) * (i + 0.5)) / 6;
      for (const [ox, oz, dx, dz] of [[60, 0, -1, 0], [40, -40, -0.7071, 0.7071], [0, -70, 0, 1]]) {
        const z = (min[2] + max[2]) / 2 + (i - 2.5) * 2;
        const o = [ox, y, z + oz];
        const d = [dx, 0, dz];
        for (const c of ['c308', 'shot']) {
          const cal = calibres[c];
          const r = evaluate({ model: m, zones, priority, o, d, energy: cal.energy, penetration: cal.penetration, cmPerPx: 6.25 * k, minEnergy: c === 'shot' ? a.game.minShotEnergy ?? 4 : a.game.minEnergy, bigGame: a.game.class !== 'small' });
          shots.push({ species: a.id, calibre: c, o, d, hit: r.hit, fate: r.fate, grade: r.grade, accuracy: r.accuracy, zones: r.zones.map((z) => `${z.zone}:${z.percent}`) });
        }
      }
    }
  }
  const ballistics = [];
  for (const c of ['c243', 'c308', 'c3006', 'c338', 'shot']) {
    for (const s of [10, 50, 100, 200, 300]) {
      const p = pointAt(calibres[c], { x: 0, y: 64, z: 0 }, { x: 0.6, y: 0.1, z: 0.7937 }, { x: 3, z: -2 }, s);
      ballistics.push({ calibre: c, s, x: p.x, y: p.y, z: p.z, energy: energyAt(calibres[c], s) });
    }
  }
  const wind = [0, 1000, 24000, 123456, 987654].map((t) => ({ t, ...windAt(t) }));
  return { shots, ballistics, wind };
}

async function itemModel(A, id, parent) {
  await write(join(A, 'models', 'item', `${id}.json`), { parent, textures: { layer0: `${NS}:item/${id}` } });
  await write(join(A, 'items', `${id}.json`), { model: { type: 'minecraft:model', model: `${NS}:item/${id}` } });
}
