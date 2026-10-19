// The mini submarine: a one-seat sub for hunting under water, with a harpoon launcher
// under the nose. Behaviour: scripts/submarine.js (Bedrock), entity/MiniSubmarine (Java).
import { NS } from './lib/constants.mjs';
import { icon, rows } from './weapons.mjs';

/**
 *   speed        top speed, blocks per tick
 *   accel        how quickly it picks up speed (blocks per tick per tick)
 *   vertical     rise / dive speed, blocks per tick
 *   turn         most it turns towards where the pilot looks, degrees per tick
 *   drag         speed kept each tick when coasting
 *   battery      charge units in a full battery; it uses `drain.idle` per tick, plus
 *                `drain.thrust` at full throttle and `drain.lights` with the lamps on
 *   charge       charge units given by each item used on the sub
 *   breakAt      boat-style damage it takes before it breaks into an item
 *   launcher     harpoon bolts fired by using a bolt while piloting
 *   line         line length of the launcher's harpoon; `winch` reels in blocks per tick
 *   seat         seat position, blocks (Bedrock); the Java seat is in MiniSubmarine
 */
export const SUB = {
  speed: 0.32,
  accel: 0.03,
  vertical: 0.12,
  turn: 6,
  drag: 0.9,
  battery: 12000,
  drain: { idle: 0.1, thrust: 1, lights: 0.2 },
  charge: { 'minecraft:redstone': 1200, 'minecraft:redstone_block': 12000 },
  breakAt: 40,
  health: 40,
  launcher: { ammo: 'harpoon_bolt', projectile: 'harpoon_bolt', cooldown: 20, speed: 3.0, power: 1.0 },
  line: 24,
  winch: 0.15,
  lightsBelow: 10,
  size: [1.6, 1.3],
  seat: [0, 0.2, 0.15],
};

const PAINT = '#e0b020';

/** Model: the hull faces -z (like the animals); the pilot's head sits in the glass dome. */
export const submarineModel = {
  bones: [
    { name: 'root', pivot: [0, 0, 0] },
    {
      name: 'hull', parent: 'root', pivot: [0, 10, 0],
      cubes: [
        { origin: [-11, 2, -16], size: [22, 6, 32], mat: 'paint' },
        { origin: [-12, 8, -14], size: [24, 8, 28], mat: 'paint' },
        { origin: [-10, 16, 0], size: [20, 5, 14], mat: 'paint' },
        { origin: [-8, 4, -20], size: [16, 10, 4], mat: 'paint' },
        { origin: [-10, 0, -12], size: [2, 2, 24], mat: 'steel' },
        { origin: [8, 0, -12], size: [2, 2, 24], mat: 'steel' },
        // The propeller's duct.
        { origin: [-6, 15, 16], size: [12, 1, 4], mat: 'steel' },
        { origin: [-6, 4, 16], size: [12, 1, 4], mat: 'steel' },
        { origin: [5, 5, 16], size: [1, 10, 4], mat: 'steel' },
        { origin: [-6, 5, 16], size: [1, 10, 4], mat: 'steel' },
        { origin: [-2, 8, 14], size: [4, 4, 4], mat: 'steel' },
      ],
    },
    { name: 'dome', parent: 'hull', pivot: [0, 16, -7], cubes: [{ origin: [-9, 16, -14], size: [18, 9, 14], mat: 'glass' }] },
    { name: 'rudder', parent: 'hull', pivot: [0, 21, 10], cubes: [{ origin: [-0.5, 21, 8], size: [1, 6, 6], mat: 'paint' }] },
    { name: 'fin_l', parent: 'hull', pivot: [12, 8, 6], cubes: [{ origin: [12, 8, 6], size: [5, 1, 6], mat: 'paint' }] },
    { name: 'fin_r', parent: 'hull', pivot: [-12, 8, 6], cubes: [{ origin: [-17, 8, 6], size: [5, 1, 6], mat: 'paint' }] },
    {
      name: 'propeller', parent: 'hull', pivot: [0, 10, 18.5],
      cubes: [
        { origin: [-5, 9.5, 18], size: [10, 1, 1], mat: 'steel' },
        { origin: [-0.5, 5, 18], size: [1, 10, 1], mat: 'steel' },
      ],
    },
    {
      name: 'launcher', parent: 'hull', pivot: [0, 3, -16],
      cubes: [
        { origin: [-2, 1, -24], size: [4, 3, 10], mat: 'steel' },
        { origin: [-0.5, 2, -27], size: [1, 1, 4], mat: 'bolt' },
      ],
    },
    {
      name: 'lamps', parent: 'hull', pivot: [0, 10, -20],
      cubes: [
        { origin: [5, 9, -21], size: [3, 3, 1], mat: 'lamp' },
        { origin: [-8, 9, -21], size: [3, 3, 1], mat: 'lamp' },
      ],
    },
    {
      name: 'lamp_glow', parent: 'lamps', pivot: [0, 10, -20],
      cubes: [
        { origin: [5, 9, -22], size: [3, 3, 1], mat: 'glow', inflate: 0.3 },
        { origin: [-8, 9, -22], size: [3, 3, 1], mat: 'glow', inflate: 0.3 },
      ],
    },
  ],
};

export const submarineMaterials = {
  paint: PAINT,
  steel: '#5a5e66',
  glass: '#a8d8f080',
  lamp: '#3a3d42',
  glow: '#fff4c0',
  bolt: '#c8ccd2',
};

/** The propeller spins while the sub is under way. */
export const submarineAnims = {
  spin: { loop: true, animation_length: 0.4, bones: { propeller: { rotation: { '0.0': [0, 0, 0], '0.2': [0, 0, 180], '0.4': [0, 0, 360] } } } },
  idle: { loop: true, bones: {} },
};

export const submarineItem = {
  id: 'mini_submarine', name: 'Mini Submarine', category: 'equipment', stack: 1,
  components: { [`${NS}:submarine_placer`]: {} },
  icon: icon(rows([
    '................',
    '................',
    '................',
    '......ggg.......',
    '.....ggggg......',
    '...yyyyyyyyy....',
    '..yyyyyyyyyyyks.',
    '.lyyyyyyyyyyyks.',
    '.lyyyyyyyyyyyks.',
    '..yyyyyyyyyyyk..',
    '...yyyyyyyyy....',
    '....s.....s.....',
    '...sssssssss....',
    '................',
    '................',
    '................',
  ], { y: PAINT, g: '#a8d8f0', k: '#3a3d42', s: '#5a5e66', l: '#fff4c0' })),
};

export const submarineRecipe = {
  'minecraft:recipe_shaped': {
    description: { identifier: `${NS}:mini_submarine` },
    tags: ['crafting_table'],
    pattern: ['IGI', 'RCR', 'IPI'],
    key: {
      I: { item: 'minecraft:iron_ingot' }, G: { item: 'minecraft:glass' }, R: { item: 'minecraft:redstone' },
      C: { item: 'minecraft:copper_block' }, P: { item: 'minecraft:piston' },
    },
    result: { item: `${NS}:mini_submarine` },
    unlock: [{ item: 'minecraft:copper_block' }],
  },
};
