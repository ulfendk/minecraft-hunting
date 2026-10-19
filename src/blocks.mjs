// Custom blocks for hiding from game:
//   camo_netting  a see-through camouflage net; build a hide (blind) from it.
//   tree_stand    a wooden platform with a rail, placed up in a tree.
// Standing inside a hide or high on a tree stand makes you much harder to see and smell
// (scripts/senses.js, hunt/Senses.java).
import { PNG } from 'pngjs';
import { hex } from './lib/texture.mjs';
import { NS } from './lib/constants.mjs';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function texture(fn) {
  const png = new PNG({ width: 16, height: 16 });
  png.data.fill(0);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const c = fn(x, y);
    if (c) png.data.set(hex(c), (y * 16 + x) * 4);
  }
  return PNG.sync.write(png);
}

/** Knotted net with leafy scraps tied in, holes in between. */
function nettingTexture() {
  const rand = rng(5);
  const leaves = ['#4a5a2a', '#5a6a32', '#3a4a22', '#6a6a3a', '#5a4a2a'];
  const cells = Array.from({ length: 256 }, () => rand());
  return texture((x, y) => {
    if (x % 4 === 0 || y % 4 === 0) return (x + y) % 3 ? '#3a3a2a' : '#4a4a32';
    const r = cells[y * 16 + x];
    return r < 0.62 ? leaves[Math.floor(r * 8) % leaves.length] : null;
  });
}

/** Weathered planks. */
function planksTexture() {
  const rand = rng(9);
  return texture((x, y) => {
    if (y % 4 === 3) return '#4a3218';
    const base = hex(['#7a5a36', '#86643c', '#6e5030'][Math.floor(y / 4) % 3]);
    const k = 0.9 + rand() * 0.15;
    return base.map((v, i) => (i < 3 ? Math.round(v * k) : v));
  });
}

const allFaces = (size) => Object.fromEntries(['north', 'south', 'east', 'west', 'up', 'down'].map((f) => [f, { uv: [0, 0], uv_size: [16, 16] }]));
const box = (origin, size) => ({ origin, size, uv: allFaces(size) });
const plane = (origin, size) => {
  const faces = size[0] === 0 ? ['east', 'west'] : ['north', 'south'];
  return { origin, size, uv: Object.fromEntries(faces.map((f) => [f, { uv: [0, 0], uv_size: [16, 16] }])) };
};

function geometry(id, cubes) {
  return {
    format_version: '1.12.0',
    'minecraft:geometry': [{
      description: { identifier: `geometry.${NS}.${id}`, texture_width: 16, texture_height: 16 },
      bones: [{ name: id, pivot: [0, 0, 0], cubes }],
    }],
  };
}

function definition(id, { collision, selection, render, seconds, category = 'construction', mapColor }) {
  return {
    format_version: '1.21.90',
    'minecraft:block': {
      description: { identifier: `${NS}:${id}`, menu_category: { category } },
      components: {
        'minecraft:geometry': `geometry.${NS}.${id}`,
        'minecraft:material_instances': { '*': { texture: `${NS}_${id}`, render_method: render, ambient_occlusion: false } },
        'minecraft:collision_box': collision,
        'minecraft:selection_box': selection ?? collision,
        'minecraft:light_dampening': 0,
        'minecraft:destructible_by_mining': { seconds_to_destroy: seconds },
        'minecraft:destructible_by_explosion': { explosion_resistance: 1 },
        'minecraft:flammable': { catch_chance_modifier: 20, destroy_chance_modifier: 40 },
        'minecraft:map_color': mapColor,
        'minecraft:display_name': `tile.${NS}:${id}.name`,
      },
    },
  };
}

export const blocks = [
  {
    id: 'camo_netting',
    name: 'Camouflage Netting',
    sound: 'wool',
    texture: nettingTexture(),
    // A thin panel in the middle of the block; you can see out through the holes.
    geometry: geometry('camo_netting', [plane([-8, 0, 0], [16, 16, 0]), plane([0, 0, -8], [0, 16, 16])]),
    definition: definition('camo_netting', {
      collision: { origin: [-8, 0, -8], size: [16, 16, 16] },
      render: 'alpha_test', seconds: 0.4, mapColor: '#4a5a2a',
    }),
  },
  {
    id: 'tree_stand',
    name: 'Tree Stand',
    sound: 'wood',
    texture: planksTexture(),
    // A platform at the bottom of the block with a rail around three sides.
    geometry: geometry('tree_stand', [
      box([-8, 0, -8], [16, 2, 16]),
      box([-8, 2, -8], [1, 10, 1]), box([7, 2, -8], [1, 10, 1]), box([-8, 2, 7], [1, 10, 1]), box([7, 2, 7], [1, 10, 1]),
      box([-8, 10, -8], [16, 1, 1]), box([-8, 10, -8], [1, 1, 16]), box([7, 10, -8], [1, 1, 16]),
    ]),
    definition: definition('tree_stand', {
      collision: { origin: [-8, 0, -8], size: [16, 2, 16] },
      selection: { origin: [-8, 0, -8], size: [16, 12, 16] },
      render: 'alpha_test', seconds: 1.0, mapColor: '#7a5a36',
    }),
  },
];

export const blockRecipes = [
  {
    'minecraft:recipe_shaped': {
      description: { identifier: `${NS}:camo_netting` },
      tags: ['crafting_table'],
      pattern: ['SVS', 'VSV', 'SVS'],
      key: { S: { item: 'minecraft:string' }, V: { item: 'minecraft:vine' } },
      result: { item: `${NS}:camo_netting`, count: 8 },
      unlock: [{ item: 'minecraft:vine' }],
    },
  },
  {
    'minecraft:recipe_shaped': {
      description: { identifier: `${NS}:tree_stand` },
      tags: ['crafting_table'],
      pattern: ['S S', 'PPP'],
      key: { S: { item: 'minecraft:stick' }, P: { item: 'minecraft:oak_slab' } },
      result: { item: `${NS}:tree_stand`, count: 2 },
      unlock: [{ item: 'minecraft:oak_slab' }],
    },
  },
];

/** No world generation in this add-on. */
export const features = {};
