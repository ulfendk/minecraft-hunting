// Hunting weapons and ammunition: four scoped rifles, a shotgun and a compound bow.
// CALIBRES drive the ballistics (scripts/lib/ballistics.js, hunt/Ballistics.java) and the
// hit-zone evaluation (penetration, energy).
import { PNG } from 'pngjs';
import { hex } from './lib/texture.mjs';
import { NS } from './lib/constants.mjs';

/**
 *   velocity      muzzle velocity, m/s
 *   energy        muzzle energy, joules
 *   drag          velocity decay per metre (v = v0 e^-ks)
 *   penetration   centimetres of muscle the bullet gets through
 *   pellets       shot charges fire several pellets with `spread` degrees of scatter
 *   range         furthest a shot is traced, blocks
 */
export const CALIBRES = {
  c243: { name: '.243 Winchester', velocity: 910, energy: 2400, drag: 0.0012, penetration: 45, range: 300 },
  c308: { name: '.308 Winchester', velocity: 820, energy: 3550, drag: 0.0011, penetration: 65, range: 320 },
  c3006: { name: '.30-06 Springfield', velocity: 880, energy: 3900, drag: 0.001, penetration: 75, range: 320 },
  c338: { name: '.338 Winchester Magnum', velocity: 900, energy: 5300, drag: 0.0008, penetration: 100, range: 350 },
  shot: { name: '12 gauge birdshot', velocity: 400, energy: 18, drag: 0.02, penetration: 5, range: 60, pellets: 9, spread: 2.2 },
  arrow: { name: 'Broadhead arrow', velocity: 90, energy: 95, drag: 0, penetration: 55, range: 80 },
};

/** Firearms: the item, its ammunition, the scope zoom levels (FOV degrees) and the bolt/pump cycle in ticks. */
export const FIREARMS = {
  rifle_243: { calibre: 'c243', ammo: 'cartridge_243', zoom: [30, 15, 8], cycle: 22, sway: 1.0 },
  rifle_308: { calibre: 'c308', ammo: 'cartridge_308', zoom: [30, 15, 8], cycle: 24, sway: 1.1 },
  rifle_3006: { calibre: 'c3006', ammo: 'cartridge_3006', zoom: [30, 15, 8], cycle: 26, sway: 1.2 },
  rifle_338: { calibre: 'c338', ammo: 'cartridge_338', zoom: [30, 12, 6], cycle: 30, sway: 1.4 },
  shotgun: { calibre: 'shot', ammo: 'shotgun_shell', zoom: null, cycle: 14, sway: 0 },
};

// ---------------------------------------------------------------- icons

/** Draw a 16x16 icon from [x, y, color] pixels. */
export function icon(pixels) {
  const png = new PNG({ width: 16, height: 16 });
  png.data.fill(0);
  for (const [x, y, c] of pixels) if (x >= 0 && y >= 0 && x < 16 && y < 16) png.data.set(hex(c), (y * 16 + x) * 4);
  return PNG.sync.write(png);
}

/** Pixels from a string map (rows of characters through a palette). */
export const rows = (map, palette) => map.flatMap((row, y) => [...row].map((ch, x) => [x, y, palette[ch]]).filter(([, , c]) => c));

const STEEL = '#3a3d42', STEEL_LIGHT = '#6a6e76', WOOD = '#7a4a26', WOOD_LIGHT = '#9a6234', BRASS = '#c9a24a', BRASS_DARK = '#8a6a2a';

/** A rifle lying left to right with a scope on top. `stock` and `barrel` vary per model. */
function rifleIcon({ stock = WOOD, stockLight = WOOD_LIGHT, barrel = STEEL, scope = '#202226', long = 0 }) {
  return icon(rows([
    '................',
    '................',
    '................',
    '.....sssssss....',
    '....sLsssssLs...',
    '.....l.....l....',
    'kk..bbbbbbbbbbbb',
    'kkkkkkkkbbbbbbb.',
    '.kkKkkkkkkk.....',
    '..kkk.t.........',
    '...kk...........',
    '................',
    '................',
    '................',
    '................',
    '................',
  ].map((r) => (long ? r : r.replace(/b(?=\.?$)/, '.'))), {
    s: scope, L: '#6a8aa8', l: '#2a2c30', b: barrel, k: stock, K: stockLight, t: STEEL_LIGHT,
  }));
}

const shotgunIcon = icon(rows([
  '................',
  '................',
  '................',
  '................',
  '................',
  '......t.........',
  'kk..bbbbbbbbbbbb',
  'kkkkkkkkpppbbbb.',
  '.kkKkkkkk.......',
  '..kkk.t.........',
  '...kk...........',
  '................',
  '................',
  '................',
  '................',
  '................',
], { b: '#2a2c30', k: '#5a3a20', K: '#7a5230', p: '#3a2a1a', t: STEEL_LIGHT }));

const bowIcon = icon(rows([
  '.........cc.....',
  '........c..s....',
  '.......c...s....',
  '......c.....s...',
  '.....cw.....s...',
  '....c..w.....s..',
  '...k....w....s..',
  '..kkh....w...s..',
  '..kkh.....w..s..',
  '...k.....w...s..',
  '....c...w....s..',
  '.....c.w....s...',
  '......cw....s...',
  '.......c...s....',
  '........c..s....',
  '.........cc.....',
], { c: '#3a4a2a', k: '#2a2a2a', h: '#5a5a5a', s: '#e8e4d8', w: '#a8a49a' }));

const cartridgeIcon = (tip = BRASS_DARK) => icon(rows([
  '................',
  '................',
  '..........t.....',
  '.........ttt....',
  '........bbbt....',
  '.......bbbb.....',
  '......bbbb..t...',
  '.....bbbb..ttt..',
  '....bbbb..bbbt..',
  '...dbbb..bbbb...',
  '...ddb..bbbb....',
  '.......bbbb.....',
  '......dbbb......',
  '......ddb.......',
  '................',
  '................',
], { b: BRASS, d: BRASS_DARK, t: tip }));

const shellIcon = icon(rows([
  '................',
  '................',
  '.........rrr....',
  '........rrrrr...',
  '.......rrrrrr...',
  '......rrrrrr....',
  '.....rrrrrr.....',
  '....brrrrr......',
  '...bbbrrr.......',
  '...bbbb.........',
  '....bb..........',
  '................',
  '................',
  '................',
  '................',
  '................',
], { r: '#b0302a', b: BRASS }));

const arrowIcon = icon([
  ...Array.from({ length: 10 }, (_, k) => [3 + k, 12 - k, '#6a5a44']),
  [13, 2, '#9aa0a8'], [12, 2, '#9aa0a8'], [13, 3, '#9aa0a8'], [14, 1, '#c8ccd2'],
  [2, 13, '#d84a2a'], [3, 13, '#d84a2a'], [2, 12, '#d84a2a'], [1, 14, '#f0e8e0'], [2, 14, '#f0e8e0'],
]);

export const weaponItems = [
  { id: 'rifle_243', name: 'Varmint Rifle (.243)', category: 'equipment', stack: 1, icon: rifleIcon({ stock: '#4a5a3a', stockLight: '#6a7a4a' }), components: { 'minecraft:durability': { max_durability: 900 } } },
  { id: 'rifle_308', name: 'Hunting Rifle (.308)', category: 'equipment', stack: 1, icon: rifleIcon({}), components: { 'minecraft:durability': { max_durability: 900 } } },
  { id: 'rifle_3006', name: 'Bolt-Action Rifle (.30-06)', category: 'equipment', stack: 1, icon: rifleIcon({ stock: '#5a321a', stockLight: '#7a4a2a', long: 1 }), components: { 'minecraft:durability': { max_durability: 900 } } },
  { id: 'rifle_338', name: 'Magnum Rifle (.338)', category: 'equipment', stack: 1, icon: rifleIcon({ stock: '#2a2c30', stockLight: '#44474e', barrel: '#55585e', long: 1 }), components: { 'minecraft:durability': { max_durability: 900 } } },
  { id: 'shotgun', name: 'Shotgun', category: 'equipment', stack: 1, icon: shotgunIcon, components: { 'minecraft:durability': { max_durability: 700 } } },
  {
    id: 'compound_bow', name: 'Compound Bow', category: 'equipment', stack: 1, icon: bowIcon,
    components: {
      'minecraft:durability': { max_durability: 500 },
      'minecraft:shooter': {
        ammunition: [{ item: `${NS}:broadhead_arrow`, use_offhand: true, search_inventory: true, use_in_creative: true }],
        max_draw_duration: 1.0,
        scale_power_by_draw_duration: true,
        charge_on_draw: false,
      },
      'minecraft:use_modifiers': { use_duration: 3600, movement_modifier: 0.4 },
      'minecraft:use_animation': 'bow',
    },
  },
  { id: 'cartridge_243', name: '.243 Cartridge', category: 'equipment', icon: cartridgeIcon('#c87a3a') },
  { id: 'cartridge_308', name: '.308 Cartridge', category: 'equipment', icon: cartridgeIcon() },
  { id: 'cartridge_3006', name: '.30-06 Cartridge', category: 'equipment', icon: cartridgeIcon('#b0b4ba') },
  { id: 'cartridge_338', name: '.338 Magnum Cartridge', category: 'equipment', icon: cartridgeIcon('#3a3d42') },
  { id: 'shotgun_shell', name: 'Shotgun Shell', category: 'equipment', icon: shellIcon },
  { id: 'broadhead_arrow', name: 'Broadhead Arrow', category: 'equipment', icon: arrowIcon, components: { 'minecraft:projectile': { projectile_entity: `${NS}:broadhead_arrow`, minimum_critical_power: 1.2 } } },
];

const shaped = (id, pattern, key, count = 1) => ({
  'minecraft:recipe_shaped': {
    description: { identifier: `${NS}:${id}` },
    tags: ['crafting_table'],
    pattern,
    key: Object.fromEntries(Object.entries(key).map(([k, v]) => [k, { item: v.includes(':') ? v : `minecraft:${v}` }])),
    result: { item: `${NS}:${id}`, count },
    unlock: [{ item: Object.values(key)[0].includes(':') ? Object.values(key)[0] : `minecraft:${Object.values(key)[0]}` }],
  },
});

export const weaponRecipes = [
  // Rifles need a spyglass for the scope.
  shaped('rifle_243', ['  S', 'III', 'PP '], { S: 'spyglass', I: 'iron_ingot', P: 'oak_planks' }),
  shaped('rifle_308', ['  S', 'III', 'LL '], { S: 'spyglass', I: 'iron_ingot', L: 'dark_oak_planks' }),
  shaped('rifle_3006', [' SI', 'III', 'LL '], { S: 'spyglass', I: 'iron_ingot', L: 'spruce_planks' }),
  shaped('rifle_338', [' SB', 'BBB', 'II '], { S: 'spyglass', B: 'iron_block', I: 'iron_ingot' }),
  shaped('shotgun', ['III', 'LL '], { I: 'iron_ingot', L: 'spruce_planks' }),
  shaped('compound_bow', [' SI', 'S I', ' SI'], { S: 'string', I: 'iron_ingot' }),
  shaped('cartridge_243', ['C', 'G', 'N'], { C: 'copper_ingot', G: 'gunpowder', N: 'iron_nugget' }, 8),
  shaped('cartridge_308', ['C', 'G', 'I'], { C: 'copper_ingot', G: 'gunpowder', I: 'iron_ingot' }, 8),
  shaped('cartridge_3006', ['CC', 'GI'], { C: 'copper_ingot', G: 'gunpowder', I: 'iron_ingot' }, 8),
  shaped('cartridge_338', ['CC', 'GG', 'II'], { C: 'copper_ingot', G: 'gunpowder', I: 'iron_ingot' }, 8),
  shaped('shotgun_shell', ['P', 'G', 'C'], { P: 'paper', G: 'gunpowder', C: 'copper_ingot' }, 8),
  shaped('broadhead_arrow', ['I', 'S', 'F'], { I: 'iron_nugget', S: 'stick', F: 'feather' }, 4),
];

/** The arrow fired by the compound bow. Its hit is evaluated by the scripts, so impact damage is nil. */
export const weaponProjectiles = [
  {
    id: 'broadhead_arrow',
    name: 'Broadhead Arrow',
    damage: 0,
    power: 3.0,
    gravity: 0.05,
    rotate: true,
    hitSound: 'random.bowhit',
    model: {
      bones: [{
        name: 'body', pivot: [0, 0, 0],
        cubes: [
          { origin: [0, 0, -7], size: [1, 1, 15], mat: 'shaft' },
          { origin: [0, -1, -9], size: [1, 3, 2], mat: 'head' },
          { origin: [-1, 0, 5], size: [3, 1, 3], mat: 'fletch' },
          { origin: [0, -1, 5], size: [1, 3, 3], mat: 'fletch' },
        ],
      }],
    },
    materials: { shaft: '#2a2a2a', head: '#9aa0a8', fletch: '#d84a2a' },
  },
];
