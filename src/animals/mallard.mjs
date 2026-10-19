import { birdAnims, gamebird } from '../lib/birds.mjs';
import { all, bone, face } from '../lib/parts.mjs';
import { fur, gradient, mottle, region, spots, underside } from '../lib/texture.mjs';

const TAIL = { w: 2, h: 1, l: 2, angle: 18 };
const body = gamebird({
  bodyW: 4, bodyH: 4, bodyL: 8, legH: 2, legW: 1, legGap: 2, legZ: 1, foot: { w: 2, d: 2 },
  neckW: 2, neckH: 3, neckD: 2, neckTilt: 6,
  headW: 3, headH: 3, headD: 3, beak: { w: 2, h: 1, d: 2, y: 0 },
  tail: TAIL,
  // The drake's black curled tail feather (hidden on hens).
  extraBones: (c) => [{
    name: 'curl', parent: 'tail', pivot: [0, c.top - 1, c.zb], zone: 'tail',
    cubes: [{ origin: [-0.5, c.top - 1, c.zb + TAIL.l - 2], size: [1, 1, 1], mat: 'curl' }],
  }],
});
const { ctx } = body;
const h = ctx.head;
const side = ({ face: f }) => f === 'left' || f === 'right';

// Blue speculum with white borders near the back of the folded wing (both sexes).
const speculum = [
  region('#f0f0ea', all(side, ({ p }) => p[1] > ctx.top - 2 && p[1] < ctx.top - 1 && p[2] > ctx.zb - 4.2 && p[2] < ctx.zb - 0.8)),
  region('#2a48b8', all(side, ({ p }) => p[1] > ctx.top - 2 && p[1] < ctx.top - 1 && p[2] > ctx.zb - 3.2 && p[2] < ctx.zb - 1.8)),
];

export default {
  id: 'mallard',
  name: 'Mallard',
  role: 'prey',
  family: ['mallard', 'waterfowl', 'game_bird', 'bird', 'game', 'small_game'],
  size: [0.5, 0.6],
  health: 6,
  speed: 0.16,
  panicSpeed: 1.6,
  fleeSpeed: 1.8,
  xp: 2,
  breed: ['wheat_seeds'],
  tempt: ['wheat_seeds'],
  sleeps: 'night',
  movement: 'fly',
  flySpeed: 0.2,
  wades: true,
  variants: [
    { name: 'drake', texture: 'drake' },
    {
      name: 'hen', texture: 'hen', weight: 1,
      materials: {
        body: {
          base: '#8a6844',
          layers: [
            spots('#3e2a18', { size: 1.6, radius: 0.3 }),
            underside('#a88a64', { y: ctx.bottom + 1.2, soft: 1.2 }),
            mottle(0.08, { scale: 3 }),
            fur(0.06),
          ],
        },
        breast: { base: '#9a7a54', layers: [spots('#4a3420', { size: 1.5, radius: 0.28 }), fur(0.06)] },
        wing: { base: '#6a5640', layers: [spots('#3a2a1a', { size: 1.6, radius: 0.3, seed: 4 }), ...speculum, fur(0.05)] },
        neck: { base: '#9a7e5a', layers: [spots('#5a4430', { size: 1.4, radius: 0.22 }), fur(0.05)] },
        head: {
          base: '#a48a64',
          layers: [
            region('#4a3a28', ({ face: f, p }) => f === 'top' || p[1] > h.top - 0.6),
            region('#4a3a28', all(side, ({ p }) => p[1] > h.top - 2 && p[1] < h.top - 1)),
            fur(0.05),
          ],
        },
        beak: { base: '#c87a30', layers: [region('#4a3a2a', ({ face: f, p }) => f === 'top' && p[2] > h.front - 1.5)] },
        tail: { base: '#8a6a46', layers: [spots('#3e2a18', { size: 1.4, radius: 0.3 }), fur(0.05)] },
        curl: '#8a6a46',
      },
    },
  ],
  variantsMixed: true,
  maleBones: ['curl'],
  spawn: [{ biomes: ['river', 'swamp'], weight: 8, group: [2, 5], blocks: ['grass_block', 'sand', 'mud'] }],
  loot: [
    { item: 'hunting:raw_game_bird', min: 1, max: 1 },
    { item: 'feather', min: 0, max: 2 },
  ],
  sounds: { ambient: 'mob.parrot.idle', hurt: 'mob.parrot.hurt', death: 'mob.parrot.death', warn: 'mob.parrot.idle', pitch: [0.55, 0.7] },
  egg: ['#1f5a2e', '#b0aea4'],
  client: { runSpeed: 4 },

  // Hunting
  game: { class: 'small', minEnergy: 150, minShotEnergy: 3, weight: [0.8, 1.4], score: 0, trophy: null, call: 'duck' },
  senses: { sight: 1.3, hearing: 1.2, smell: 0.3, alertTime: 8, herd: 8 },

  model: { bones: body.bones },
  organs: body.organs,

  // Drake plumage (the default texture is variant 0's).
  materials: {
    body: {
      base: '#b4b2a8',
      layers: [
        region('#6c6050', all(bone('body'), face('top'))),
        region('#6a3020', ({ p }) => p[2] < ctx.zf + 1.5),
        region('#ecece4', ({ p }) => p[2] > ctx.zb - 2.5),
        region('#1c1c20', ({ p }) => p[2] > ctx.zb - 1.5),
        mottle(0.05, { scale: 2 }),
        fur(0.07),
      ],
    },
    breast: { base: '#6a3020', layers: [mottle(0.08, { scale: 2 }), fur(0.05)] },
    wing: {
      base: '#7a7266',
      layers: [gradient('#5e564c', { axis: 1, from: ctx.top - 3, to: ctx.top }), ...speculum, fur(0.05)],
    },
    // Glossy green neck with the white collar; chestnut below it.
    neck: {
      base: '#1d5a2e',
      layers: [region('#f2f2ea', ({ p }) => p[1] >= ctx.top && p[1] < ctx.top + 1), region('#6a3020', ({ p }) => p[1] < ctx.top), fur(0.04)],
    },
    head: { base: '#1b5a2c', layers: [gradient('#2a6e64', { axis: 1, from: h.bottom, to: h.top + 1 }), mottle(0.06, { scale: 2 }), fur(0.04)] },
    beak: { base: '#d8c240', layers: [region('#3a3a20', all(face('front', 'top'), ({ p }) => p[2] < h.front - 1.5)), gradient('#c8b030', { axis: 2, from: h.front, to: h.front - 2 })] },
    tail: { base: '#e2e2da', layers: [region('#1c1c20', ({ face: f }) => f === 'top' || f === 'bottom')] },
    curl: '#1c1c20',
    leg: '#e88a2a',
    foot: '#e88a2a',
  },

  anims: birdAnims({ width: 4, swims: true, swing: 30, walkLength: 0.7, runLength: 0.35, sleepDrop: 2 }),
};
