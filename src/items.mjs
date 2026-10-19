// Custom items: hunting gear, food, hides and trophies (weapons are in weapons.mjs).
import { NS } from './lib/constants.mjs';
import { pixelIcon } from './lib/texture.mjs';
import { icon, rows, weaponItems, weaponRecipes } from './weapons.mjs';
import { divingItems, divingRecipes } from './diving.mjs';
import { submarineItem, submarineRecipe } from './submarine.mjs';

/** Every item that can field dress a carcass. */
export const KNIVES = ['hunting_knife', 'dive_knife'];

/** Armour sets: what repairs them and how long they last (Bedrock durability). */
export const ARMOR_SETS = {
  ghillie: { repair: 'minecraft:vine', durability: 120 },
  dive: { repair: 'minecraft:leather', durability: 200 },
  snorkel: { repair: 'minecraft:leather', durability: 200 },
};

const MEAT = { '.': null, o: '#5a1f1a', r: '#a8343a', p: '#d06a6b', w: '#f0d9c8' };
const COOKED = { '.': null, o: '#3b2213', r: '#7a4a2b', p: '#a8703f', w: '#e7c79a' };
const steak = [
  '................',
  '................',
  '.....oooooo.....',
  '...oorrrrrroo...',
  '..orrpprrrrrro..',
  '.orrpprrrrrrrro.',
  '.orpprrrrwwrrro.',
  '.orrrrrrwwrrro..',
  '.orrrrrrrrrrro..',
  '..orrrrrrrrro...',
  '...oorrrrroo....',
  '.....ooooo......',
  '................',
  '................',
  '................',
  '................',
];
const drumstick = [
  '................',
  '................',
  '......ooo.......',
  '....oorrroo.....',
  '...orrpprrro....',
  '...orpprrrro....',
  '...orrrrrrro....',
  '....orrrrro.....',
  '.....orrroo.....',
  '......ooww......',
  '.......oww......',
  '........ww......',
  '.......w..w.....',
  '................',
  '................',
  '................',
];

const FILLET = {
  raw: { o: '#a04a3a', r: '#e08a78', p: '#f4b8a8', w: '#f8e8e0' },
  cooked: { o: '#6a3a1a', r: '#c08a4a', p: '#e0b070', w: '#f0d8b0' },
};
const fillet = [
  '................',
  '................',
  '................',
  '................',
  '..oooooooooo....',
  '.orrrpprrrrroo..',
  'orrpprrrrwrrrro.',
  'orrrrrrwwrrrrro.',
  '.orrrrrrrrrppro.',
  '..oorrrrrrrroo..',
  '....oooooooo....',
  '................',
  '................',
  '................',
  '................',
  '................',
];

const ghillie = { '.': null, g: '#4a5a2a', l: '#6a7a3a', b: '#5a4a2a', d: '#2f3a1a' };

export const items = [
  {
    id: 'hunting_journal',
    name: 'Hunting Journal',
    category: 'equipment',
    stack: 1,
    icon: pixelIcon([
      '................',
      '..bbbbbbbbbbb...',
      '..bggggggggggb..',
      '..bgbbbbbbbbgb..',
      '..bgbwwwwwwbgb..',
      '..bgbwkwwkwbgb..',
      '..bgbwkkkkwbgb..',
      '..bgbwwkkwwbgb..',
      '..bgbwkwwkwbgb..',
      '..bgbwwwwwwbgb..',
      '..bgbbbbbbbbgb..',
      '..bggggggggggb..',
      '..bppppppppppb..',
      '..bbbbbbbbbbb...',
      '................',
      '................',
    ], { '.': null, b: '#3a2a1a', g: '#5a6a3a', w: '#e9d8a6', k: '#7a4a22', p: '#f4ecd8' }),
  },
  {
    id: 'binoculars',
    name: 'Binoculars',
    category: 'equipment',
    stack: 1,
    components: { 'minecraft:use_modifiers': { use_duration: 3600, movement_modifier: 0.5 } },
    icon: icon(rows([
      '................',
      '................',
      '................',
      '...kkk....kkk...',
      '..kgggk..kgggk..',
      '..kgggkkkkgggk..',
      '..kgggkmmkgggk..',
      '..kgggk..kgggk..',
      '..kgggk..kgggk..',
      '.kkkkkkk.kkkkkkk',
      '.klllllk.klllllk',
      '.klbbblk.klbbblk',
      '.kkkkkkk.kkkkkkk',
      '................',
      '................',
      '................',
    ], { k: '#1e2022', g: '#3a4a2a', m: '#6a6e76', l: '#5a6a7a', b: '#9ab8d8' })),
  },
  {
    id: 'wind_checker',
    name: 'Wind Checker',
    category: 'equipment',
    stack: 1,
    components: { 'minecraft:durability': { max_durability: 64 } },
    icon: pixelIcon([
      '................',
      '......kk........',
      '......rr........',
      '.....wwww.......',
      '.....wppw...p...',
      '.....wppw..p.p..',
      '.....wppw.p..p..',
      '.....wppwp......',
      '.....wppw.......',
      '.....wppw.......',
      '.....wwww.......',
      '................',
      '................',
      '................',
      '................',
      '................',
    ], { '.': null, k: '#2a2a2a', r: '#c03030', w: '#e8e8e8', p: '#f0ead8' }),
  },
  ...['deer_call', 'duck_call', 'predator_call'].map((id, k) => ({
    id,
    name: ['Deer Grunt Call', 'Duck Call', 'Predator Call'][k],
    category: 'equipment',
    stack: 1,
    components: { 'minecraft:cooldown': { category: `${NS}:call`, duration: 4 } },
    icon: icon(rows([
      '................',
      '................',
      '................',
      '................',
      '..........b.....',
      '.........bbb....',
      '.cccccccbbbbb...',
      'ccccccccbbbbbb..',
      'ccccccccbbbbbb..',
      '.cccccccbbbbb...',
      '.........bbb....',
      '..........b.....',
      '................',
      '................',
      '................',
      '................',
    ], { c: ['#7a4a26', '#3a5a2a', '#2a2a2a'][k], b: ['#3a2a1a', '#7a5a3a', '#8a2a2a'][k] })),
  })),
  {
    id: 'scent_eliminator',
    name: 'Scent Eliminator',
    category: 'equipment',
    stack: 16,
    icon: icon(rows([
      '................',
      '......kkk.......',
      '......kgk.......',
      '.....kkkkk......',
      '.....kgggk......',
      '....kgggggk.....',
      '....kglllgk.....',
      '....kgllllk.....',
      '....kgllllk.....',
      '....kglllgk.....',
      '....kgggggk.....',
      '....kkkkkkk.....',
      '................',
      '................',
      '................',
      '................',
    ], { k: '#1e2a1a', g: '#3a5a2a', l: '#a8c878' })),
  },
  {
    id: 'hunting_knife',
    name: 'Hunting Knife',
    category: 'equipment',
    stack: 1,
    components: {
      'minecraft:damage': 4,
      'minecraft:durability': { max_durability: 250 },
      'minecraft:hand_equipped': true,
      'minecraft:enchantable': { slot: 'sword', value: 10 },
      'minecraft:repairable': { repair_items: [{ items: ['minecraft:iron_ingot'], repair_amount: 80 }] },
    },
    icon: icon([
      ...Array.from({ length: 5 }, (_, k) => [2 + k, 13 - k, '#4a2a1a']),
      ...Array.from({ length: 5 }, (_, k) => [3 + k, 13 - k, '#6a3a1e']),
      [7, 9, '#2a2a2a'], [8, 8, '#2a2a2a'], [6, 8, '#2a2a2a'], [8, 10, '#2a2a2a'],
      ...Array.from({ length: 6 }, (_, k) => [8 + k, 7 - k, '#c8ccd2']),
      ...Array.from({ length: 5 }, (_, k) => [8 + k, 8 - k, '#9aa0a8']),
    ]),
  },
  {
    id: 'dog_whistle',
    name: 'Dog Whistle',
    category: 'equipment',
    stack: 1,
    components: { 'minecraft:cooldown': { category: `${NS}:whistle`, duration: 2 } },
    icon: icon(rows([
      '................',
      '................',
      '................',
      '................',
      '................',
      '..........kk....',
      '.ssssssssskk....',
      'sssssssssss.....',
      'sssssssssss.....',
      '.ssssssssd......',
      '.......ddd......',
      '................',
      '................',
      '................',
      '................',
      '................',
    ], { s: '#c8ccd2', d: '#8a8e96', k: '#c03030' })),
  },
  {
    id: 'ghillie_hood', name: 'Ghillie Hood', category: 'equipment', stack: 1,
    armor: { set: 'ghillie', slot: 'head', protection: 1, geometry: 'helmet' },
    icon: icon(rows(['................', '................', '....glgldg......', '...gllggllg.....', '..glgbgglglg....', '..lggl..ggdl....', '..gld....lgg....', '..dg......lg....', '..g........g....', '................', '................', '................', '................', '................', '................', '................'], ghillie)),
  },
  {
    id: 'ghillie_jacket', name: 'Ghillie Jacket', category: 'equipment', stack: 1,
    armor: { set: 'ghillie', slot: 'chest', protection: 2, geometry: 'chestplate' },
    icon: icon(rows(['................', '..gl......lg....', '.gllg....glgl...', '.glggllglgglg...', '.dlglgglgldgl...', '..dlgbglgglg....', '...glgglgldg....', '...gglglgglg....', '...lgdglglgg....', '...gglgglgdl....', '...lglgdgglg....', '...gglglgglg....', '................', '................', '................', '................'], ghillie)),
  },
  {
    id: 'ghillie_trousers', name: 'Ghillie Trousers', category: 'equipment', stack: 1,
    armor: { set: 'ghillie', slot: 'legs', protection: 2, geometry: 'leggings' },
    icon: icon(rows(['................', '...glglglgg.....', '...gglgdglg.....', '...lgdg.lgd.....', '...gglg.glg.....', '...lgg..gdl.....', '...glg..lgg.....', '...gdl..glg.....', '...lgg..ggl.....', '...glg..lgd.....', '................', '................', '................', '................', '................', '................'], ghillie)),
  },
  {
    id: 'ghillie_boots', name: 'Ghillie Boots', category: 'equipment', stack: 1,
    armor: { set: 'ghillie', slot: 'feet', protection: 1, geometry: 'boots' },
    icon: icon(rows(['................', '................', '................', '................', '................', '...glg..gld.....', '...lgd..dgl.....', '...glg..glg.....', '..glgb..bglg....', '..bbbb..bbbb....', '................', '................', '................', '................', '................', '................'], ghillie)),
  },
  { id: 'raw_venison', name: 'Raw Venison', category: 'nature', food: { nutrition: 4, saturation: 0.3 }, icon: pixelIcon(steak, MEAT) },
  { id: 'cooked_venison', name: 'Venison Steak', category: 'nature', food: { nutrition: 9, saturation: 0.8 }, icon: pixelIcon(steak, COOKED) },
  { id: 'raw_game_meat', name: 'Raw Game Meat', category: 'nature', food: { nutrition: 3, saturation: 0.3 }, icon: pixelIcon(steak, { ...MEAT, r: '#b5413a', p: '#e08070' }) },
  { id: 'cooked_game_meat', name: 'Cooked Game Meat', category: 'nature', food: { nutrition: 8, saturation: 0.8 }, icon: pixelIcon(steak, { ...COOKED, r: '#8a4f2b' }) },
  { id: 'raw_game_bird', name: 'Raw Game Bird', category: 'nature', food: { nutrition: 2, saturation: 0.3 }, icon: pixelIcon(drumstick, { ...MEAT, r: '#e0a090', p: '#f0c0b0' }) },
  { id: 'cooked_game_bird', name: 'Roast Game Bird', category: 'nature', food: { nutrition: 7, saturation: 0.7 }, icon: pixelIcon(drumstick, { ...COOKED, r: '#b0703a', p: '#d09050' }) },
  { id: 'raw_fish_fillet', name: 'Raw Fish Fillet', category: 'nature', food: { nutrition: 2, saturation: 0.2 }, icon: pixelIcon(fillet, { '.': null, ...FILLET.raw }) },
  { id: 'cooked_fish_fillet', name: 'Grilled Fish Fillet', category: 'nature', food: { nutrition: 6, saturation: 0.8 }, icon: pixelIcon(fillet, { '.': null, ...FILLET.cooked }) },
  {
    id: 'deer_hide',
    name: 'Deer Hide',
    category: 'items',
    icon: icon(rows(['................', '..h..........h..', '..hhh......hhh..', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '..hhhhhhhhhhhh..', '..hhhhhhhhhhhh..', '..hhhhhhhhhhhh..', '..hhhhhhhhhhhh..', '...hhhhhhhhhh...', '...hhhhhhhhhh...', '..hhh......hhh..', '..h..........h..', '................', '................', '................'], { h: '#9a7454' })),
  },
  {
    id: 'pelt',
    name: 'Pelt',
    category: 'items',
    icon: icon(rows(['................', '..f..........f..', '..fff......fff..', '...ffffffffff...', '...ffgffffgff...', '..ffffffffffff..', '..fffgfffgffff..', '..ffffffffffff..', '..ffgffffffgff..', '...ffffffffff...', '...fffgffffff...', '..fff......fff..', '..f..........f..', '................', '................', '................'], { f: '#7a6a5a', g: '#5a4a3a' })),
  },
  ...[
    ['trophy_antlers', 'Antler Trophy', '#d8c8a8'],
    ['trophy_paddles', 'Moose Paddle Trophy', '#c8b898'],
    ['trophy_tusks', 'Boar Tusk Trophy', '#f0ead8'],
    ['trophy_skull', 'Skull Trophy', '#e8e0d0'],
    ['trophy_fan', 'Tail Fan Trophy', '#7a4a2a'],
  ].map(([id, name, c]) => ({
    id, name, category: 'items', stack: 1,
    icon: icon(rows([
      '................',
      '..a.a......a.a..',
      '..a.a......a.a..',
      '..aaa......aaa..',
      '...aa.a..a.aa...',
      '....aaa..aaa....',
      '.....aa..aa.....',
      '......aaaa......',
      '.....wwwwww.....',
      '....wwwwwwww....',
      '....wwbwwbww....',
      '....wwwwwwww....',
      '.....wwwwww.....',
      '......wwww......',
      '.......ww.......',
      '................',
    ], { a: c, w: '#7a4a26', b: '#2a1a10' })),
  })),
  {
    id: 'trophy_tuna', name: 'Mounted Tuna Trophy', category: 'items', stack: 1,
    icon: icon(rows([
      '................',
      '................',
      '..............t.',
      '.............tt.',
      '...bbbbbbbbbbtt.',
      '..bbbbbbbbbbbt..',
      '.ebbbbbbbbbbbtt.',
      '.ssssssssssss.tt',
      '..ssssssssss....',
      '...ssssssss.....',
      '................',
      '.wwwwwwwwwwwwww.',
      '.wwwwwwwwwwwwww.',
      '................',
      '................',
      '................',
    ], { b: '#1c2c4a', s: '#c8d0d8', t: '#2a3550', e: '#0a0a0a', w: '#7a4a26' })),
  },
  {
    id: 'trophy_shark_jaw', name: 'Shark Jaw Trophy', category: 'items', stack: 1,
    icon: icon(rows([
      '................',
      '...pppppppppp...',
      '..pwpwpwpwpwpp..',
      '.pp..........pp.',
      '.pw..........wp.',
      '.pp..........pp.',
      '.pw..........wp.',
      '.pp..........pp.',
      '..pwpwpwpwpwpp..',
      '...pppppppppp...',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ], { p: '#d8c8b8', w: '#fafaf6' })),
  },
];

items.push(...weaponItems, ...divingItems, submarineItem);

const shapeless = (id, ingredients, result = `${NS}:${id}`, count = 1) => ({
  'minecraft:recipe_shapeless': {
    description: { identifier: `${NS}:${id}` },
    tags: ['crafting_table'],
    ingredients: ingredients.map((item) => ({ item: item.includes(':') ? item : `minecraft:${item}` })),
    result: { item: result, count },
    unlock: [{ item: ingredients[0].includes(':') ? ingredients[0] : `minecraft:${ingredients[0]}` }],
  },
});
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
const furnace = (id, input) => ({
  'minecraft:recipe_furnace': {
    description: { identifier: `${NS}:${id}` },
    tags: ['furnace', 'smoker', 'campfire', 'soul_campfire'],
    input: `${NS}:${input}`,
    output: `${NS}:${id}`,
  },
});

export const recipes = [
  shapeless('hunting_journal', ['book', 'feather']),
  shaped('binoculars', ['I I', 'GIG'], { I: 'iron_ingot', G: 'glass_pane' }),
  shapeless('wind_checker', ['glass_bottle', 'bone_meal']),
  shaped('deer_call', ['PPS'], { P: 'oak_planks', S: 'string' }),
  shaped('duck_call', ['PPR'], { P: 'oak_planks', R: 'sugar_cane' }),
  shaped('predator_call', ['PPR'], { P: 'oak_planks', R: 'rabbit_hide' }),
  shapeless('scent_eliminator', ['glass_bottle', 'charcoal', 'fern'], `${NS}:scent_eliminator`, 1),
  shaped('hunting_knife', [' I', 'S '], { I: 'iron_ingot', S: 'stick' }),
  shaped('dog_whistle', ['II '], { I: 'iron_nugget' }),
  shaped('ghillie_hood', ['VVV', 'V V'], { V: 'vine' }),
  shaped('ghillie_jacket', ['V V', 'VVV', 'VVV'], { V: 'vine' }),
  shaped('ghillie_trousers', ['VVV', 'V V', 'V V'], { V: 'vine' }),
  shaped('ghillie_boots', ['V V', 'V V'], { V: 'vine' }),
  furnace('cooked_venison', 'raw_venison'),
  furnace('cooked_game_meat', 'raw_game_meat'),
  furnace('cooked_game_bird', 'raw_game_bird'),
  furnace('cooked_fish_fillet', 'raw_fish_fillet'),
  shapeless('leather_from_deer_hide', [`${NS}:deer_hide`], 'minecraft:leather', 2),
  shapeless('leather_from_pelt', [`${NS}:pelt`], 'minecraft:leather', 1),
];

recipes.push(...weaponRecipes, ...divingRecipes, submarineRecipe);

const ARMOR_SLOTS = { head: 'slot.armor.head', chest: 'slot.armor.chest', legs: 'slot.armor.legs', feet: 'slot.armor.feet' };
const ENCHANT_SLOTS = { head: 'armor_head', chest: 'armor_torso', legs: 'armor_legs', feet: 'armor_feet' };

export function buildItem(item) {
  const components = {
    'minecraft:icon': `${NS}_${item.id}`,
    'minecraft:display_name': { value: `item.${NS}:${item.id}.name` },
    'minecraft:max_stack_size': item.stack ?? 64,
  };
  if (item.food) {
    Object.assign(components, {
      'minecraft:food': { nutrition: item.food.nutrition, saturation_modifier: item.food.saturation },
      'minecraft:use_animation': 'eat',
      'minecraft:use_modifiers': { use_duration: 1.6, movement_modifier: 0.35 },
    });
  }
  if (item.armor) {
    const set = ARMOR_SETS[item.armor.set];
    Object.assign(components, {
      'minecraft:wearable': { slot: ARMOR_SLOTS[item.armor.slot], protection: item.armor.protection },
      'minecraft:durability': { max_durability: set.durability },
      ...(item.armor.noRepair ? {} : { 'minecraft:repairable': { repair_items: [{ items: [set.repair], repair_amount: Math.round(set.durability / 3) }] } }),
      'minecraft:enchantable': { slot: ENCHANT_SLOTS[item.armor.slot], value: 10 },
    });
  }
  Object.assign(components, item.components ?? {});
  return {
    format_version: '1.21.90',
    'minecraft:item': {
      description: { identifier: `${NS}:${item.id}`, menu_category: { category: item.category ?? 'items' } },
      components,
    },
  };
}
