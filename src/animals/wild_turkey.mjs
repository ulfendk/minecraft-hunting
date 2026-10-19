import { birdAnims, gamebird } from '../lib/birds.mjs';
import { all, bone, face } from '../lib/parts.mjs';
import { fur, gradient, mottle, region, stripes, underside } from '../lib/texture.mjs';

const FAN = 8; // tail-fan feather length
const FAN_ANGLES = [-80, -60, -40, -20, 0, 20, 40, 60, 80];
const body = gamebird({
  bodyW: 6, bodyH: 6, bodyL: 10, legH: 5, legW: 1, legGap: 2, foot: { w: 1, d: 3 },
  neckW: 2, neckH: 5, neckD: 2, neckTilt: 12,
  headW: 2, headH: 3, headD: 3, beak: { w: 1, h: 1, d: 1, y: 1 },
  tail: { w: 4, h: 1, l: 3, angle: -8 }, wingInset: 1,
  // Red wattle hanging under the chin.
  headExtras: (h) => [{ origin: [-0.5, h.bottom - 2, h.front], size: [1, 2, 2], mat: 'wattle' }],
  // Tom only: the raised display fan, the chest beard and the long snood over the beak.
  extraBones: (c) => [
    {
      name: 'fan', parent: 'body', pivot: [0, c.top - 1, c.zb], rotation: [-6, 0, 0], zone: 'tail',
      cubes: FAN_ANGLES.map((a) => ({
        origin: [-1, c.top - 1, c.zb], size: [2, FAN, 1], mat: 'fan', rotation: [0, 0, a], pivot: [0, c.top - 1, c.zb + 0.5],
      })),
    },
    { name: 'beard', parent: 'body', pivot: [0, c.top - 2, c.zf - 1], cubes: [{ origin: [-0.5, c.top - 5, c.zf - 2], size: [1, 3, 1], mat: 'beard' }] },
    { name: 'snood', parent: 'head', pivot: [0, c.head.bottom + 2, c.head.front], cubes: [{ origin: [-0.5, c.head.bottom - 1, c.head.front - 2], size: [1, 3, 1], mat: 'wattle' }] },
  ],
});
const { ctx } = body;
const h = ctx.head;
const fanBase = ctx.top - 1;

export default {
  id: 'wild_turkey',
  name: 'Wild Turkey',
  role: 'prey',
  family: ['turkey', 'game_bird', 'bird', 'game', 'small_game'],
  size: [0.6, 0.9],
  scale: 1.2,
  health: 12,
  speed: 0.22,
  panicSpeed: 1.9,
  fleeSpeed: 2.1,
  xp: 3,
  breed: ['wheat_seeds'],
  tempt: ['wheat_seeds'],
  sleeps: 'night',
  fallImmune: true,
  variants: [
    { name: 'tom', texture: 'tom' },
    {
      name: 'hen', texture: 'hen', weight: 1,
      materials: {
        body: {
          base: '#5e4630',
          layers: [stripes('#b89c74', { axis: 1, period: 2, width: 0.3, warp: 0.6 }), underside('#4a3828', { y: ctx.bottom + 1.5, soft: 1.5 }), mottle(0.08, { scale: 3 }), fur(0.06)],
        },
        breast: { base: '#5e4630', layers: [stripes('#b89c74', { axis: 1, period: 2, width: 0.3, warp: 0.4 }), fur(0.06)] },
        wing: {
          base: '#3a3028',
          layers: [stripes('#c8bca8', { axis: 2, period: 2, width: 0.45, warp: 0.3 }), region('#6a5038', ({ p }) => p[1] > ctx.top - 2), fur(0.05)],
        },
        neck: { base: '#8a7a6a', layers: [region('#5e4630', ({ p }) => p[1] < ctx.top + 1.5), fur(0.05)] },
        head: { base: '#8e9cac', layers: [region('#7a6a62', ({ face: f }) => f === 'top'), fur(0.04)] },
        wattle: '#b08080',
        tail: { base: '#6a5038', layers: [stripes('#2a201a', { axis: 2, period: 1.5, width: 0.35, warp: 0.2 }), fur(0.05)] },
      },
    },
  ],
  variantsMixed: true,
  maleBones: ['fan', 'beard', 'snood'],
  spawn: [{ biomes: ['forest', 'plains'], weight: 5, group: [2, 5], blocks: ['grass_block', 'podzol'] }],
  loot: [
    { item: 'hunting:raw_game_bird', min: 1, max: 2 },
    { item: 'feather', min: 1, max: 3 },
  ],
  sounds: { ambient: 'mob.chicken.say', hurt: 'mob.chicken.hurt', death: 'mob.parrot.death', warn: 'mob.parrot.idle', pitch: [0.5, 0.65] },
  egg: ['#4a3826', '#c83a3a'],
  client: { runSpeed: 4 },

  // Hunting
  game: { class: 'small', minEnergy: 300, minShotEnergy: 5, weight: [5, 11], score: 80, trophy: 'trophy_fan', maleTrophy: true },
  senses: { sight: 1.8, hearing: 1.2, smell: 0.5, alertTime: 12, herd: 6 },

  model: { bones: body.bones },
  organs: body.organs,

  // Tom plumage (the default texture is variant 0's): dark bronze with black-tipped feathers.
  materials: {
    body: {
      base: '#5a4026',
      layers: [
        stripes('#1c1612', { axis: 1, period: 2, width: 0.4, warp: 0.6 }),
        gradient('#7a5a30', { axis: 2, from: 0, to: ctx.zb }),
        underside('#2a2018', { y: ctx.bottom + 1.5, soft: 1.5 }),
        mottle(0.1, { scale: 3 }),
        fur(0.06),
      ],
    },
    breast: { base: '#5a4026', layers: [stripes('#1c1612', { axis: 1, period: 2, width: 0.4, warp: 0.4 }), mottle(0.08, { scale: 2 }), fur(0.06)] },
    // Barred black-and-white flight feathers, bronze coverts on top.
    wing: {
      base: '#2a2420',
      layers: [
        stripes('#d8d0c0', { axis: 2, period: 2, width: 0.45, warp: 0.3 }),
        region('#6a4a2a', ({ p }) => p[1] > ctx.top - 3),
        fur(0.05),
      ],
    },
    // Bare red neck above a ruff of bronze feathers.
    neck: { base: '#c8423c', layers: [mottle(0.15, { scale: 1 }), region('#5a4026', ({ p }) => p[1] < ctx.top + 1.5)] },
    // Bare blue crown and face, red throat.
    head: {
      base: '#8ab8e0',
      layers: [region('#d0dcf0', ({ face: f }) => f === 'top'), region('#c8423c', all(({ face: f }) => f !== 'top', ({ p }) => p[1] < h.bottom + 1)), fur(0.04)],
    },
    beak: '#d0b890',
    wattle: { base: '#c8302c', layers: [mottle(0.15, { scale: 1 })] },
    beard: '#141010',
    tail: { base: '#4a3420', layers: [stripes('#1c1612', { axis: 2, period: 1.5, width: 0.35, warp: 0.2 }), fur(0.05)] },
    // Chestnut fan feathers, finely barred, with a black band and a buff tip.
    fan: {
      base: '#6a4426',
      layers: [
        stripes('#2a1a10', { axis: 1, period: 1.5, width: 0.3, warp: 0.2 }),
        region('#141010', ({ p }) => p[1] > fanBase + FAN - 2),
        region('#c89a5a', ({ p }) => p[1] > fanBase + FAN - 1),
        fur(0.04),
      ],
    },
    leg: '#c87a6a',
    foot: '#a86a5a',
  },

  anims: birdAnims({ width: 6, swing: 35, walkLength: 0.8, runLength: 0.4, sleepDrop: 4 }),
};
