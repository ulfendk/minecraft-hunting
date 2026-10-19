// Generates the behavior pack and resource pack into build/.
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { animationFile } from '../src/lib/anim.mjs';
import { buildEntity, buildLoot, buildSpawnRules } from '../src/lib/behavior.mjs';
import { buildAnimationControllers, buildClientEntity, buildEntitySounds, buildRenderController } from '../src/lib/client.mjs';
import { MIN_ENGINE, NS, PACK_NAME, SCRIPT_SERVER_VERSION, SCRIPT_UI_VERSION } from '../src/lib/constants.mjs';
import { packIcon } from '../src/lib/icon.mjs';
import { langEntries, LOCALES, missingFoods } from '../src/lang.mjs';
import { guideEntry } from '../src/lib/info.mjs';
import { render } from './render.mjs';
import { buildJava } from './java.mjs';
import { buildGeometry } from '../src/lib/model.mjs';
import { paintTexture } from '../src/lib/texture.mjs';
import { buildItem, items, recipes } from '../src/items.mjs';
import { blockRecipes, blocks, features } from '../src/blocks.mjs';
import { buildHelper, buildHelperClient, buildProjectile, buildProjectileClient, helpers, projectiles } from '../src/projectiles.mjs';
import { buildHitModel } from '../src/lib/hitmodel.mjs';
import { CALIBRES, FIREARMS } from '../src/weapons.mjs';
import { GRADES, ZONE_PRIORITY, ZONES } from '../src/zones.mjs';
import { HUD_CHARS, hudScreen, SCOPE_PREFIX, XRAY_PREFIX } from '../src/hud.mjs';
import { xray, xrayView } from './xray.mjs';
import { black, scopeTexture } from './hudart.mjs';
import { armorLayer } from '../src/lib/armor.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'build');
const BP = join(OUT, 'behavior_pack');
const RP = join(OUT, 'resource_pack');

const UUID = {
  bpHeader: 'abc7c974-1eea-4d27-878c-6a4bfc0241d1',
  bpData: '65c95bac-ad12-4225-b64f-4e3d04744274',
  bpScript: '095ee983-5267-4de0-b76e-d5a17f2df517',
  rpHeader: '914effc3-8455-4df0-8ebc-51dcb6900885',
  rpResources: '456837fe-ee6a-41ff-b46b-0a760c6d4f00',
};

const textureCache = new WeakMap();
async function paintTextureCached(geo, a) {
  if (!textureCache.has(a)) textureCache.set(a, paintTexture(geo, a.materials));
  return textureCache.get(a);
}

async function write(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data, null, 2) + '\n');
}

export async function loadAnimals() {
  const dir = join(ROOT, 'src', 'animals');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.mjs')).sort();
  const animals = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    animals.push(mod.default);
  }
  linkFoodWeb(animals);
  return animals;
}

/** Prey automatically flees from every species that hunts it. */
function linkFoodWeb(animals) {
  for (const prey of animals) {
    const families = new Set([prey.id, ...(prey.family ?? [])]);
    const hunters = animals.filter((p) => p !== prey && (p.hunts ?? []).some((h) => families.has(h)));
    prey.fleesFrom = [...new Set([...(prey.fleesFrom ?? []), ...hunters.map((h) => h.id)])];
  }
}

function manifests(version) {
  const v = version.split('.').map(Number);
  const bp = {
    format_version: 2,
    header: {
      name: `${PACK_NAME} v${version} (Behavior)`,
      description: 'pack.description',
      uuid: UUID.bpHeader,
      version: v,
      min_engine_version: MIN_ENGINE,
    },
    modules: [
      { type: 'data', uuid: UUID.bpData, version: v },
      { type: 'script', language: 'javascript', uuid: UUID.bpScript, version: v, entry: 'scripts/main.js' },
    ],
    dependencies: [
      { uuid: UUID.rpHeader, version: v },
      { module_name: '@minecraft/server', version: SCRIPT_SERVER_VERSION },
      { module_name: '@minecraft/server-ui', version: SCRIPT_UI_VERSION },
    ],
    metadata: { authors: ['Realistic Hunting contributors'], license: 'MIT' },
  };
  const rp = {
    format_version: 2,
    header: {
      name: `${PACK_NAME} v${version} (Resources)`,
      description: 'pack.description',
      uuid: UUID.rpHeader,
      version: v,
      min_engine_version: MIN_ENGINE,
    },
    modules: [{ type: 'resources', uuid: UUID.rpResources, version: v }],
    dependencies: [{ uuid: UUID.bpHeader, version: v }],
    metadata: { authors: ['Realistic Hunting contributors'], license: 'MIT' },
  };
  return { bp, rp };
}

export async function build({ quiet = false } = {}) {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  await rm(BP, { recursive: true, force: true });
  await rm(RP, { recursive: true, force: true });

  // Hand-written files first; generated files may add to the same folders.
  await cp(join(ROOT, 'src', 'packs', 'behavior_pack'), BP, { recursive: true });
  await cp(join(ROOT, 'src', 'packs', 'resource_pack'), RP, { recursive: true });

  const { bp, rp } = manifests(pkg.version);
  await write(join(BP, 'manifest.json'), bp);
  await write(join(RP, 'manifest.json'), rp);
  const icon = packIcon();
  await write(join(BP, 'pack_icon.png'), icon);
  await write(join(RP, 'pack_icon.png'), icon);

  const animals = await loadAnimals();
  const java = { geos: {}, anims: {}, textures: {}, langs: {}, xrays: {}, armor: {} };
  const entitySounds = {};
  const report = [];

  for (const a of animals) {
    // Behavior
    await write(join(BP, 'entities', `${a.id}.json`), buildEntity(a));
    await write(join(BP, 'spawn_rules', `${a.id}.json`), buildSpawnRules(a));
    await write(join(BP, 'loot_tables', 'entities', `${NS}_${a.id}.json`), buildLoot(a));

    // Model + texture
    const geo = buildGeometry(`geometry.${NS}.${a.id}`, a.model);
    await write(join(RP, 'models', 'entity', `${a.id}.geo.json`), geo.geometry);
    await write(join(RP, 'textures', 'entity', NS, `${a.id}.png`), await paintTextureCached(geo, a));
    java.geos[a.id] = geo.geometry;
    java.textures[a.id] = await paintTextureCached(geo, a);
    for (const v of a.variants ?? []) {
      if (v.texture) {
        const variantTexture = paintTexture(geo, { ...a.materials, ...v.materials });
        await write(join(RP, 'textures', 'entity', NS, `${a.id}_${v.texture}.png`), variantTexture);
        java.textures[`${a.id}_${v.texture}`] = variantTexture;
      }
    }

    // Animation
    const animNames = Object.keys(a.anims);
    await write(join(RP, 'animations', `${a.id}.animation.json`), animationFile(a.id, a.anims));
    java.anims[a.id] = animationFile(a.id, a.anims);
    await write(join(RP, 'animation_controllers', `${a.id}.animation_controllers.json`), buildAnimationControllers(a, animNames));
    await write(join(RP, 'entity', `${a.id}.entity.json`), buildClientEntity(a, animNames, a.egg));
    const boneNames = a.model.bones.map((b) => b.name);
    await write(join(RP, 'render_controllers', `${a.id}.render_controllers.json`), buildRenderController(a, boneNames));

    // Portrait for the Hunting Journal.
    const hidden = new Set(['saddle', 'chest']);
    await write(join(RP, 'textures', 'ui', NS, `${a.id}.png`), render(geo.geometry, await paintTextureCached(geo, a), { yaw: 35, size: 64, hidden }));

    // Hit zones and the x-ray images for the shot report.
    if (a.game) {
      a.hitModel = buildHitModel(a);
      // Females and young don't have the male-only parts (antlers, a turkey's fan).
      a.hitModelFemale = a.maleBones?.length ? buildHitModel(a, { exclude: new Set(a.maleBones) }) : null;
      a.xrayView = xrayView(a);
      const zones = [...new Set([...a.hitModel.organs.map((o) => o[3]), ...a.hitModel.cubes.map((c) => c[3])])];
      a.xrayZones = zones;
      await write(join(RP, 'textures', 'ui', NS, 'xray', `${a.id}.png`), xray(a));
      for (const z of zones) {
        const png = xray(a, z);
        await write(join(RP, 'textures', 'ui', NS, 'xray', `${a.id}_${z}.png`), png);
        java.xrays[`${a.id}_${z}`] = png;
      }
      java.xrays[a.id] = xray(a);
    }

    entitySounds[`${NS}:${a.id}`] = buildEntitySounds(a);
    report.push(`${a.id} (${geo.width}x${geo.height})`);
  }

  // Projectiles
  for (const p of projectiles) {
    const geo = buildGeometry(`geometry.hunting.${p.id}`, p.model);
    await write(join(BP, 'entities', `${p.id}.json`), buildProjectile(p));
    await write(join(RP, 'entity', `${p.id}.entity.json`), buildProjectileClient(p));
    await write(join(RP, 'models', 'entity', `${p.id}.geo.json`), geo.geometry);
    await write(join(RP, 'textures', 'entity', NS, `${p.id}.png`), paintTexture(geo, p.materials));
    java.geos[p.id] = geo.geometry;
    java.textures[p.id] = paintTexture(geo, p.materials);
    await write(join(RP, 'render_controllers', `${p.id}.render_controllers.json`), {
      format_version: '1.8.0',
      render_controllers: { [`controller.render.hunting.${p.id}`]: { geometry: 'Geometry.default', materials: [{ '*': 'Material.default' }], textures: ['Texture.default'] } },
    });
  }

  for (const h of helpers) {
    const geo = buildGeometry(`geometry.hunting.${h.id}`, { bones: [{ name: 'root', pivot: [0, 0, 0], cubes: [{ origin: [0, 0, 0], size: [0, 0, 0], mat: 'none' }] }] });
    await write(join(BP, 'entities', `${h.id}.json`), buildHelper(h));
    await write(join(RP, 'entity', `${h.id}.entity.json`), buildHelperClient(h));
    await write(join(RP, 'models', 'entity', `${h.id}.geo.json`), geo.geometry);
    await write(join(RP, 'textures', 'entity', NS, `${h.id}.png`), paintTexture(geo, { none: '#00000000' }));
    await write(join(RP, 'render_controllers', `${h.id}.render_controllers.json`), {
      format_version: '1.8.0',
      render_controllers: { [`controller.render.hunting.${h.id}`]: { geometry: 'Geometry.default', materials: [{ '*': 'Material.default' }], textures: ['Texture.default'] } },
    });
  }

  // Data for the scripts: species, hit models, zones, calibres, HUD codes.
  const game = animals.filter((a) => a.game);
  const data = animals.map((a) => ({
    ...guideEntry(a),
    ...(a.game ? {
      game: a.game,
      senses: a.senses,
      scale: a.scale ?? 1,
      health: a.health,
      bird: a.movement === 'fly',
      hitModel: a.hitModel,
      hitModelFemale: a.hitModelFemale,
      xrayZones: a.xrayZones,
      loot: a.loot ?? [],
      sounds: { warn: a.sounds?.warn ?? a.sounds?.ambient ?? null, pitch: a.sounds?.pitch ?? [1, 1] },
    } : {}),
  }));
  const itemIds = [...items.map((i) => `${NS}:${i.id}`), ...blocks.map((b) => `${NS}:${b.id}`)];
  const zoneData = Object.fromEntries(Object.entries(ZONES).map(([k, z]) => [k, { fate: z.fate, bleedSeconds: z.bleedSeconds, damage: z.damage, density: z.density, vital: z.vital, blood: z.blood, slows: z.slows ?? 0 }]));
  await write(join(BP, 'scripts', 'data.js'), [
    '// Generated by tools/build.mjs',
    `export const ANIMALS = ${JSON.stringify(data)};`,
    `export const ITEMS = ${JSON.stringify(itemIds)};`,
    `export const ZONES = ${JSON.stringify(zoneData)};`,
    `export const ZONE_PRIORITY = ${JSON.stringify(ZONE_PRIORITY)};`,
    `export const GRADES = ${JSON.stringify(Object.keys(GRADES))};`,
    `export const CALIBRES = ${JSON.stringify(CALIBRES)};`,
    `export const FIREARMS = ${JSON.stringify(FIREARMS)};`,
    `export const GAME = ${JSON.stringify(game.map((a) => a.id))};`,
    `export const HUD = ${JSON.stringify({ chars: HUD_CHARS, scope: SCOPE_PREFIX, xray: XRAY_PREFIX })};`,
    '',
  ].join('\n'));

  // HUD: a scope overlay per rifle and zoom level, an x-ray per species and zone.
  const scopes = [];
  Object.entries(FIREARMS).forEach(([id, f], r) => {
    (f.zoom ?? []).forEach((fov, z) => {
      const texture = `textures/ui/${NS}/scope_${id}_${z}`;
      scopes.push({ rifle: r, zoom: z, texture });
    });
  });
  for (const s of scopes) {
    const [id, f] = Object.entries(FIREARMS)[s.rifle];
    await write(join(RP, `${s.texture}.png`), scopeTexture(CALIBRES[f.calibre], f.zoom[s.zoom]));
  }
  await write(join(RP, 'textures', 'ui', NS, 'black.png'), black());
  const xrays = [];
  game.forEach((a, si) => a.xrayZones.forEach((z) => xrays.push({ species: si, zone: ZONE_PRIORITY.indexOf(z), texture: `textures/ui/${NS}/xray/${a.id}_${z}` })));
  await write(join(RP, 'ui', 'hud_screen.json'), hudScreen(scopes, xrays));

  // Items
  const itemTextures = {};
  for (const item of items) {
    await write(join(BP, 'items', `${item.id}.json`), buildItem(item));
    await write(join(RP, 'textures', 'items', NS, `${item.id}.png`), item.icon);
    itemTextures[`${NS}_${item.id}`] = { textures: `textures/items/${NS}/${item.id}` };
    if (item.armor) {
      // Worn on the player with the vanilla armour geometry and our own armour layer texture.
      const layer = item.armor.slot === 'legs' ? 2 : 1;
      const visible = { head: 'helmet', chest: 'chest', legs: 'leg', feet: 'boot' }[item.armor.slot];
      await write(join(RP, 'attachables', `${item.id}.json`), {
        format_version: '1.10.0',
        'minecraft:attachable': {
          description: {
            identifier: `${NS}:${item.id}`,
            materials: { default: 'armor', enchanted: 'armor_enchanted' },
            textures: { default: `textures/models/armor/${NS}_ghillie_${layer}`, enchanted: 'textures/misc/enchanted_item_glint' },
            geometry: { default: `geometry.player.armor.${item.armor.geometry}` },
            scripts: { parent_setup: `variable.${visible}_layer_visible = 0.0;` },
            render_controllers: ['controller.render.armor'],
          },
        },
      });
    }
  }
  for (const layer of [1, 2]) {
    const png = armorLayer(layer);
    await write(join(RP, 'textures', 'models', 'armor', `${NS}_ghillie_${layer}.png`), png);
    java.armor[layer] = png;
  }
  // Blocks
  const terrain = {};
  const blockSounds = { format_version: [1, 1, 0] };
  for (const block of blocks) {
    await write(join(BP, 'blocks', `${block.id}.json`), block.definition);
    await write(join(RP, 'models', 'blocks', `${block.id}.geo.json`), block.geometry);
    await write(join(RP, 'textures', 'blocks', NS, `${block.id}.png`), block.texture);
    terrain[`${NS}_${block.id}`] = { textures: `textures/blocks/${NS}/${block.id}` };
    blockSounds[`${NS}:${block.id}`] = { sound: block.sound ?? 'stone' };
  }
  await write(join(RP, 'textures', 'terrain_texture.json'), {
    resource_pack_name: NS, texture_name: 'atlas.terrain', padding: 8, num_mip_levels: 4, texture_data: terrain,
  });
  await write(join(RP, 'blocks.json'), blockSounds);
  for (const [path, body] of Object.entries(features)) await write(join(BP, path), body);

  for (const recipe of [...recipes, ...blockRecipes]) {
    const body = Object.values(recipe)[0];
    const name = body.description.identifier.split(':')[1];
    await write(join(BP, 'recipes', `${name}.json`), { format_version: '1.12', ...recipe });
  }
  await write(join(RP, 'textures', 'item_texture.json'), {
    resource_pack_name: NS,
    texture_name: 'atlas.items',
    texture_data: itemTextures,
  });

  // Sounds: entity events point at vanilla sound definitions.
  await write(join(RP, 'sounds.json'), { entity_sounds: { entities: entitySounds } });

  // Language
  const missing = missingFoods(animals);
  if (missing.length) throw new Error(`Add translations for these foods in src/lang.mjs: ${missing.join(', ')}`);
  for (const locale of LOCALES) {
    const entries = langEntries(locale, {
      animals, items, blocks, extraEntities: [...projectiles, ...helpers], description: pkg.description, version: pkg.version,
    });
    java.langs[locale] = entries;
    const text = entries.map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
    for (const pack of [BP, RP]) await write(join(pack, 'texts', `${locale}.lang`), text);
  }
  for (const pack of [BP, RP]) await write(join(pack, 'texts', 'languages.json'), LOCALES);

  // Java edition resources
  const speciesCount = await buildJava({
    animals, ...java, items, blocks, recipes: [...recipes, ...blockRecipes], projectiles, icon,
    calibres: CALIBRES, firearms: FIREARMS, zones: ZONES, priority: ZONE_PRIORITY,
    OUT: join(ROOT, 'java', 'src', 'generated', 'resources'),
  });

  if (!quiet) console.log(`Java: ${speciesCount} species written to java/src/generated/resources`);
  if (!quiet) console.log(`Built ${animals.length} animals: ${report.join(', ')}\nItems: ${items.map((i) => i.id).join(', ')}`);
  return { animals, version: pkg.version };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  build().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
