// Diving gear for spearfishing: a snorkel, a dive mask and scuba tank, fins and a dive knife.
// The air rules are in scripts/diving.js and hunt/Diving.java.
import { NS } from './lib/constants.mjs';
import { icon, rows } from './weapons.mjs';

/**
 *   tankSeconds        seconds of air in a full scuba tank
 *   refillPerSecond    seconds of air a tank gets back per second at the surface
 *   snorkelClearance   the snorkel works while this far (blocks) above the eyes is air
 *   knifeBonus         extra damage the dive knife does under water
 */
export const DIVE = { tankSeconds: 900, refillPerSecond: 30, snorkelClearance: 0.6, knifeBonus: 3 };

const NEOPRENE = '#1e2226', TRIM = '#e0b020';

export const divingItems = [
  {
    id: 'snorkel', name: 'Snorkel', category: 'equipment', stack: 1,
    armor: { slot: 'head', protection: 0, geometry: 'helmet', set: 'snorkel' },
    icon: icon(rows([
      '..........yy....',
      '..........yy....',
      '..........yy....',
      '..........yy....',
      '..........yy....',
      '..kkkkkkk.yy....',
      '.kgggkgggkyy....',
      '.kgggkgggkyy....',
      '.kgggkgggkky....',
      '..kkk.kkk.......',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ], { k: NEOPRENE, g: '#8ab8d8', y: TRIM })),
  },
  {
    id: 'dive_mask', name: 'Dive Mask', category: 'equipment', stack: 1,
    armor: { slot: 'head', protection: 1, geometry: 'helmet', set: 'dive' },
    icon: icon(rows([
      '................',
      '................',
      '................',
      '..kkkkkkkkkkk...',
      '.kyyyyyyyyyyyk..',
      '.kygggggggggyk..',
      '.kyggwggggggyk..',
      '.kygwgggggggyk..',
      '.kygggggggggyk..',
      '.kyyyyykyyyyyk..',
      '..kkkkk.kkkkk...',
      '................',
      '................',
      '................',
      '................',
      '................',
    ], { k: NEOPRENE, g: '#7aa8c8', w: '#e8f4fc', y: TRIM })),
  },
  {
    id: 'scuba_tank', name: 'Scuba Tank', category: 'equipment', stack: 1,
    armor: { slot: 'chest', protection: 1, geometry: 'chestplate', set: 'dive', noRepair: true },
    // Durability is the air left in the tank, in seconds (scripts/diving.js).
    components: { 'minecraft:durability': { max_durability: DIVE.tankSeconds + 1, damage_chance: { min: 0, max: 0 } } },
    icon: icon(rows([
      '......kkk.......',
      '.....kmmmk......',
      '......kmk.......',
      '.....yyyyy......',
      '....yyyyyyy.....',
      '....ylyyyyy.....',
      '....ylyyyyy.....',
      '....kkkkkkk.....',
      '....ylyyyyy.....',
      '....ylyyyyy.....',
      '....yyyyyyy.....',
      '....kkkkkkk.....',
      '....yyyyyyy.....',
      '.....yyyyy......',
      '................',
      '................',
    ], { k: NEOPRENE, m: '#8a8e96', y: TRIM, l: '#f4d860' })),
  },
  {
    id: 'dive_fins', name: 'Dive Fins', category: 'equipment', stack: 1,
    armor: { slot: 'feet', protection: 1, geometry: 'boots', set: 'dive' },
    icon: icon(rows([
      '................',
      '................',
      '................',
      '...kk.....kk....',
      '...kk.....kk....',
      '..kkkk...kkkk...',
      '..kyyk...kyyk...',
      '.kyyyyk.kyyyyk..',
      '.kyyyyk.kyyyyk..',
      'kyyyyyykyyyyyyk.',
      'kyyyyyykyyyyyyk.',
      'kkkkkkkkkkkkkkk.',
      '................',
      '................',
      '................',
      '................',
    ], { k: NEOPRENE, y: TRIM })),
  },
  {
    id: 'dive_knife', name: 'Dive Knife', category: 'equipment', stack: 1,
    components: {
      'minecraft:damage': 4,
      'minecraft:durability': { max_durability: 400 },
      'minecraft:hand_equipped': true,
      'minecraft:enchantable': { slot: 'sword', value: 10 },
      'minecraft:repairable': { repair_items: [{ items: ['minecraft:iron_ingot'], repair_amount: 120 }] },
    },
    icon: icon([
      ...Array.from({ length: 5 }, (_, k) => [2 + k, 13 - k, NEOPRENE]),
      ...Array.from({ length: 5 }, (_, k) => [3 + k, 13 - k, TRIM]),
      [7, 9, '#2a2a2a'], [8, 8, '#2a2a2a'], [6, 8, '#2a2a2a'], [8, 10, '#2a2a2a'],
      ...Array.from({ length: 6 }, (_, k) => [8 + k, 7 - k, '#e4e8ec']),
      ...Array.from({ length: 5 }, (_, k) => [8 + k, 8 - k, '#aab2ba']),
      [9, 5, '#6a7078'], [11, 3, '#6a7078'],
    ]),
  },
];

const shaped = (id, pattern, key) => ({
  'minecraft:recipe_shaped': {
    description: { identifier: `${NS}:${id}` },
    tags: ['crafting_table'],
    pattern,
    key: Object.fromEntries(Object.entries(key).map(([k, v]) => [k, { item: v.includes(':') ? v : `minecraft:${v}` }])),
    result: { item: `${NS}:${id}` },
    unlock: [{ item: Object.values(key)[0].includes(':') ? Object.values(key)[0] : `minecraft:${Object.values(key)[0]}` }],
  },
});

export const divingRecipes = [
  shaped('snorkel', ['S  ', 'SGG'], { S: 'sugar_cane', G: 'glass_pane' }),
  shaped('dive_mask', ['LLL', 'GLG'], { L: 'leather', G: 'glass_pane' }),
  shaped('scuba_tank', ['ICI', 'I I', 'III'], { I: 'iron_ingot', C: 'copper_ingot' }),
  shaped('dive_fins', ['S S', 'L L'], { S: 'slime_ball', L: 'leather' }),
  shaped('dive_knife', [' I', 'P '], { I: 'iron_ingot', P: 'prismarine_shard' }),
];
