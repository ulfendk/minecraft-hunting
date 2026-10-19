// Static checks for build/. The dedicated server validates the behavior pack;
// this mostly covers the resource pack, which only clients load.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { pathToFileURL } from 'node:url';

const BP = 'build/behavior_pack';
const RP = 'build/resource_pack';
const errors = [];
const err = (msg) => errors.push(msg);

async function files(dir, ext) {
  const out = [];
  async function walk(d) {
    let names;
    try { names = await readdir(d); } catch { return; }
    for (const n of names) {
      const p = join(d, n);
      if ((await stat(p)).isDirectory()) await walk(p);
      else if (!ext || n.endsWith(ext)) out.push(p);
    }
  }
  await walk(dir);
  return out;
}

async function json(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (e) {
    err(`${path}: invalid JSON (${e.message})`);
    return null;
  }
}

const exists = (p) => stat(p).then(() => true, () => false);

// ------------------------------------------------------------ load everything
const bpEntities = new Map();
for (const f of await files(join(BP, 'entities'), '.json')) {
  const j = await json(f);
  if (j) bpEntities.set(j['minecraft:entity'].description.identifier, { file: f, json: j });
}

const geometries = new Map();
for (const f of await files(join(RP, 'models'), '.json')) {
  const j = await json(f);
  for (const g of j?.['minecraft:geometry'] ?? []) geometries.set(g.description.identifier, { file: f, g });
}

const animations = new Map();
for (const f of await files(join(RP, 'animations'), '.json')) {
  const j = await json(f);
  for (const [k, v] of Object.entries(j?.animations ?? {})) animations.set(k, v);
}

const controllers = new Map();
for (const f of await files(join(RP, 'animation_controllers'), '.json')) {
  const j = await json(f);
  for (const [k, v] of Object.entries(j?.animation_controllers ?? {})) controllers.set(k, v);
}

const renderControllers = new Map();
for (const f of await files(join(RP, 'render_controllers'), '.json')) {
  const j = await json(f);
  for (const [k, v] of Object.entries(j?.render_controllers ?? {})) renderControllers.set(k, v);
}

const lang = new Map(
  (await readFile(join(RP, 'texts', 'en_US.lang'), 'utf8'))
    .split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const customItems = new Map();
for (const f of await files(join(BP, 'items'), '.json')) {
  const j = await json(f);
  if (j) customItems.set(j['minecraft:item'].description.identifier, j);
}

for (const f of await files(join(BP, 'blocks'), '.json')) {
  const j = await json(f);
  if (j) customItems.set(j['minecraft:block'].description.identifier, j);
}

// ------------------------------------------------------------ checks
function balanced(expr, where) {
  if (typeof expr !== 'string') return;
  let depth = 0;
  for (const ch of expr) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) break;
  }
  if (depth !== 0) err(`${where}: unbalanced parentheses in Molang "${expr}"`);
}

async function checkTexture(path, where, size) {
  const file = `${join(RP, path)}.png`;
  if (!(await exists(file))) return err(`${where}: missing texture ${file}`);
  const png = PNG.sync.read(await readFile(file));
  if (size && (png.width !== size[0] || png.height !== size[1])) {
    err(`${where}: texture ${file} is ${png.width}x${png.height}, geometry expects ${size[0]}x${size[1]}`);
  }
}

const clientIds = new Set();
for (const f of await files(join(RP, 'entity'), '.json')) {
  const j = await json(f);
  if (!j) continue;
  const d = j['minecraft:client_entity'].description;
  const where = `${f} (${d.identifier})`;
  clientIds.add(d.identifier);
  if (!bpEntities.has(d.identifier)) err(`${where}: no behavior entity with this identifier`);

  const geos = Object.values(d.geometry).map((id) => geometries.get(id));
  Object.values(d.geometry).forEach((id, i) => { if (!geos[i]) err(`${where}: unknown geometry ${id}`); });
  const g = geos[0]?.g;
  const bones = new Set(g?.bones.map((b) => b.name) ?? []);
  const texSize = g ? [g.description.texture_width, g.description.texture_height] : null;

  for (const t of Object.values(d.textures)) await checkTexture(t, where, texSize);

  // Geometry sanity
  if (g) {
    for (const b of g.bones) {
      if (b.parent && !bones.has(b.parent)) err(`${where}: bone ${b.name} has unknown parent ${b.parent}`);
      for (const c of b.cubes ?? []) {
        const [w, h, dd] = c.size;
        const [u, v] = c.uv;
        if (u + 2 * (w + dd) > texSize[0] || v + dd + h > texSize[1]) err(`${where}: cube in bone ${b.name} has UVs outside the texture`);
      }
    }
  }

  // Animations and controllers
  const shortNames = new Set(Object.keys(d.animations ?? {}));
  for (const [short, full] of Object.entries(d.animations ?? {})) {
    if (full.startsWith('controller.')) {
      const ctrl = controllers.get(full);
      if (!ctrl) { err(`${where}: unknown animation controller ${full}`); continue; }
      if (!ctrl.states?.[ctrl.initial_state ?? 'default']) err(`${where}: controller ${full} has no initial state`);
      for (const [stateName, state] of Object.entries(ctrl.states)) {
        for (const a of state.animations ?? []) {
          const n = typeof a === 'string' ? a : Object.keys(a)[0];
          if (!shortNames.has(n)) err(`${where}: controller ${full} state ${stateName} plays unknown animation "${n}"`);
        }
        for (const t of state.transitions ?? []) {
          const [target, cond] = Object.entries(t)[0];
          if (!ctrl.states[target]) err(`${where}: controller ${full} transitions to unknown state ${target}`);
          balanced(cond, `${where}: ${full}.${stateName}`);
        }
      }
    } else {
      const anim = animations.get(full);
      if (!anim) { err(`${where}: unknown animation ${full}`); continue; }
      for (const bone of Object.keys(anim.bones ?? {})) {
        if (!bones.has(bone)) err(`${where}: animation ${full} moves bone "${bone}" that the model does not have`);
      }
    }
  }
  for (const a of d.scripts?.animate ?? []) {
    const n = typeof a === 'string' ? a : Object.keys(a)[0];
    if (!shortNames.has(n)) err(`${where}: scripts.animate uses unknown animation "${n}"`);
    if (typeof a !== 'string') balanced(Object.values(a)[0], where);
  }

  for (const rcName of d.render_controllers ?? []) {
    const name = typeof rcName === 'string' ? rcName : Object.keys(rcName)[0];
    const rc = renderControllers.get(name);
    if (!rc) { err(`${where}: unknown render controller ${name}`); continue; }
    for (const entry of rc.part_visibility ?? []) {
      const [bone, cond] = Object.entries(entry)[0];
      if (bone !== '*' && !bones.has(bone)) err(`${where}: render controller ${name} toggles unknown bone "${bone}"`);
      balanced(cond, `${where}: ${name}`);
    }
    for (const t of Object.values(rc.arrays?.textures ?? {}).flat()) {
      const key = t.replace('Texture.', '');
      if (!d.textures[key]) err(`${where}: render controller ${name} references undefined texture "${key}"`);
    }
  }

  if (!lang.has(`entity.${d.identifier}.name`)) err(`${where}: missing lang key entity.${d.identifier}.name`);
  if (!lang.has(`item.spawn_egg.entity.${d.identifier}.name`)) err(`${where}: missing spawn egg name`);
}

for (const id of bpEntities.keys()) {
  if (!clientIds.has(id)) err(`${id}: behavior entity has no client entity`);
}

// Loot tables and the items they drop
for (const [id, { json: j }] of bpEntities) {
  const tables = new Set();
  JSON.stringify(j, (k, v) => { if (k === 'table') tables.add(v); return v; });
  for (const t of tables) {
    const lt = (await exists(join(BP, t))) ? await json(join(BP, t)) : null;
    if (!lt) { err(`${id}: missing loot table ${t}`); continue; }
    for (const pool of lt.pools ?? []) {
      for (const e of pool.entries ?? []) {
        if (e.type === 'item' && !e.name.startsWith('minecraft:') && !customItems.has(e.name)) {
          err(`${t}: drops unknown item ${e.name}`);
        }
      }
    }
  }
}

// Items: icon textures and names
const itemAtlas = (await json(join(RP, 'textures', 'item_texture.json')))?.texture_data ?? {};
const terrainAtlas = (await json(join(RP, 'textures', 'terrain_texture.json')))?.texture_data ?? {};
for (const [id, j] of customItems) {
  if (j['minecraft:block']) {
    const tex = j['minecraft:block'].components['minecraft:material_instances']?.['*']?.texture;
    if (!terrainAtlas[tex]) err(`${id}: texture "${tex}" is not in terrain_texture.json`);
    else await checkTexture(terrainAtlas[tex].textures, id);
    if (!lang.has(`tile.${id}.name`)) err(`${id}: missing lang key tile.${id}.name`);
    continue;
  }
  const icon = j['minecraft:item'].components['minecraft:icon'];
  const key = typeof icon === 'string' ? icon : icon?.textures?.default;
  if (!itemAtlas[key]) err(`${id}: icon "${key}" is not in item_texture.json`);
  else await checkTexture(itemAtlas[key].textures, id);
  if (!lang.has(`item.${id}.name`)) err(`${id}: missing lang key item.${id}.name`);
}

// Every hunting: item referenced in an item field must exist.
const ITEM_KEYS = new Set(['item', 'spawn_item', 'input', 'output', 'items', 'breed_items', 'name']);
function itemRefs(node, key, out) {
  if (typeof node === 'string') {
    if (ITEM_KEYS.has(key) && node.startsWith('hunting:')) out.push(node);
  } else if (Array.isArray(node)) {
    for (const v of node) itemRefs(v, key, out);
  } else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) itemRefs(v, k, out);
  }
}
for (const f of await files(BP, '.json')) {
  const refs = [];
  itemRefs(await json(f), '', refs);
  for (const id of refs) if (!customItems.has(id)) err(`${f}: references unknown item ${id}`);
}

// Sounds must exist in vanilla sound definitions.
const vanillaSounds = new Set(JSON.parse(await readFile('tools/data/vanilla_sounds.json', 'utf8')));
const sounds = await json(join(RP, 'sounds.json'));
for (const [entity, def] of Object.entries(sounds?.entity_sounds?.entities ?? {})) {
  for (const [event, value] of Object.entries(def.events ?? {})) {
    const name = typeof value === 'string' ? value : value.sound;
    if (!vanillaSounds.has(name)) err(`${entity}: sound event ${event} uses unknown sound "${name}"`);
  }
}

// Languages: every locale has exactly the keys English has, all non-empty,
// and every key the Field Guide builds from its data exists.
const readLang = async (file) => new Map(
  (await readFile(file, 'utf8')).split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const locales = await json(join(RP, 'texts', 'languages.json')) ?? [];
const english = await readLang(join(RP, 'texts', 'en_US.lang'));
for (const locale of locales) {
  for (const pack of [BP, RP]) {
    const file = join(pack, 'texts', `${locale}.lang`);
    if (!(await exists(file))) { err(`${file}: missing`); continue; }
    const l = await readLang(file);
    for (const k of english.keys()) if (!l.get(k)) err(`${file}: missing or empty "${k}"`);
    for (const k of l.keys()) if (!english.has(k)) err(`${file}: "${k}" is not in en_US.lang`);
  }
}
const data = await import(pathToFileURL(join(BP, 'scripts', 'data.js')).href);
for (const a of data.ANIMALS) {
  const keys = [
    `hunting.guide.entry.${a.id}`,
    ...a.habitats.map((h) => `hunting.habitat.${h}`),
    ...a.tags.map((t) => `hunting.tag.${t}`),
    ...[...a.food, ...a.tame].map((f) => `hunting.food.${f}`),
  ];
  for (const k of keys) if (!english.has(k)) err(`Journal (${a.id}) uses missing lang key ${k}`);
}

// Every literal lang key in the scripts, and every key they build from data, exists.
const scriptKeys = new Set();
for (const f of await files(join(BP, 'scripts'), '.js')) {
  const src = await readFile(f, 'utf8');
  for (const m of src.matchAll(/translate: '([a-z0-9_.:]+)'/g)) scriptKeys.add(m[1]);
}
const COMPASS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
for (const g of data.GRADES) scriptKeys.add(`hunting.grade.${g}`);
for (const z of Object.keys(data.ZONES)) scriptKeys.add(`hunting.zone.${z}`);
for (const b of new Set(Object.values(data.ZONES).map((z) => z.blood))) scriptKeys.add(`hunting.blood.${b}`);
for (const side of ['left', 'right', 'front', 'rear', 'top', 'bottom']) scriptKeys.add(`hunting.side.${side}`);
for (const c of COMPASS) scriptKeys.add(`hunting.wind.${c}`), scriptKeys.add(`hunting.wind.arrow.${c}`);
for (let i = 0; i <= 5; i++) scriptKeys.add(`hunting.wind.strength.${i}`);
for (let i = 0; i <= 4; i++) scriptKeys.add(`hunting.hud.state.${i}`);
for (const o of ['kill', 'mortal', 'wound', 'none', 'miss']) scriptKeys.add(`hunting.report.outcome.${o}`);
for (const n of ['underpowered', 'meat_damage']) scriptKeys.add(`hunting.report.note.${n}`);
for (const f of Object.values(data.FIREARMS)) scriptKeys.add(`item.hunting:${f.ammo}.name`);
for (const k of scriptKeys) if (!english.has(k)) err(`scripts use missing lang key ${k}`);

// HUD overlays: every texture exists.
const hud = await json(join(RP, 'ui', 'hud_screen.json'));
const hudTextures = new Set();
(function walk(n) {
  if (Array.isArray(n)) n.forEach(walk);
  else if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) (k === 'texture' ? hudTextures.add(v) : walk(v));
})(hud);
for (const t of hudTextures) if (!(await exists(join(RP, `${t}.png`)))) err(`hud_screen.json: missing texture ${t}`);

// Particles the scripts spawn exist.
const particles = new Set();
for (const f of await files(join(RP, 'particles'), '.json')) particles.add((await json(f))?.particle_effect?.description?.identifier);
for (const f of await files(join(BP, 'scripts'), '.js')) {
  for (const m of (await readFile(f, 'utf8')).matchAll(/'(hunting:[a-z_]+)'/g)) {
    if (/blood|puff/.test(m[1]) && !particles.has(m[1])) err(`${f}: unknown particle ${m[1]}`);
  }
}

// Manifests
for (const pack of [BP, RP]) {
  const m = await json(join(pack, 'manifest.json'));
  if (m && (!m.header?.uuid || !Array.isArray(m.header.version))) err(`${pack}/manifest.json: bad header`);
}

if (errors.length) {
  console.error(`${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`OK: ${bpEntities.size} entities, ${geometries.size} models, ${animations.size} animations, ${customItems.size} items`);
