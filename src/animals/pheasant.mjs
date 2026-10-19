import { birdAnims, gamebird } from '../lib/birds.mjs';
import { all, bone, face } from '../lib/parts.mjs';
import { fur, gradient, mottle, region, spots, stripes, underside } from '../lib/texture.mjs';

const TAIL = { w: 2, h: 1, l: 4, angle: 12 };
const body = gamebird({
  bodyW: 4, bodyH: 4, bodyL: 8, legH: 3, legW: 1, legGap: 2, foot: { w: 1, d: 3 },
  neckW: 2, neckH: 4, neckD: 2, neckTilt: 12,
  headW: 3, headH: 3, headD: 3, beak: { w: 1, h: 1, d: 1, y: 0 },
  tail: TAIL,
  // Ear tufts on the back of the crown.
  headExtras: (h) => [
    { origin: [0.5, h.top, h.back - 1], size: [1, 1, 1], mat: 'head' },
    { origin: [-1.5, h.top, h.back - 1], size: [1, 1, 1], mat: 'head' },
  ],
  // The cock's long, pointed central tail feathers (hidden on hens).
  extraBones: (c) => [{
    name: 'tail_long', parent: 'tail', pivot: [0, c.top - 1, c.zb],
    cubes: [{ origin: [-1, c.top - 2, c.zb + TAIL.l - 1], size: [2, 1, 9], mat: 'tail' }],
  }],
});
const { ctx } = body;
const h = ctx.head;
const faceSide = ({ face: f }) => f === 'left' || f === 'right';

export default {
  id: 'pheasant',
  name: 'Common Pheasant',
  role: 'prey',
  family: ['pheasant', 'game_bird', 'bird', 'game', 'small_game'],
  size: [0.5, 0.7],
  health: 6,
  speed: 0.22,
  panicSpeed: 1.8,
  fleeSpeed: 2.0,
  xp: 2,
  breed: ['wheat_seeds'],
  tempt: ['wheat_seeds'],
  sleeps: 'night',
  movement: 'fly',
  flySpeed: 0.18,
  variants: [
    { name: 'cock', texture: 'cock' },
    {
      name: 'hen', texture: 'hen', weight: 1,
      materials: {
        body: { base: '#a08058', layers: [spots('#4a3420', { size: 2, radius: 0.28 }), underside('#c8ac80', { y: ctx.bottom + 1.5, soft: 1.5 }), mottle(0.1, { scale: 3 }), fur(0.06)] },
        breast: { base: '#b89870', layers: [spots('#6a4c30', { size: 2, radius: 0.25 }), fur(0.06)] },
        wing: { base: '#94744c', layers: [spots('#3e2c1a', { size: 2, radius: 0.32, seed: 5 }), fur(0.06)] },
        neck: { base: '#a88a62', layers: [spots('#5a4028', { size: 1.5, radius: 0.25 }), fur(0.05)] },
        head: { base: '#a0845e', layers: [region('#5a4230', ({ face: f }) => f === 'top'), fur(0.05)] },
        tail: { base: '#9a7a50', layers: [stripes('#3a2818', { axis: 2, period: 2, width: 0.35, warp: 0.3 }), fur(0.05)] },
      },
    },
  ],
  variantsMixed: true,
  maleBones: ['tail_long'],
  spawn: [{ biomes: ['plains', 'forest'], weight: 6, group: [1, 3], blocks: ['grass_block', 'podzol'] }],
  loot: [
    { item: 'hunting:raw_game_bird', min: 1, max: 1 },
    { item: 'feather', min: 0, max: 2 },
  ],
  sounds: { ambient: 'mob.chicken.say', hurt: 'mob.chicken.hurt', death: 'mob.parrot.death', warn: 'mob.parrot.idle', pitch: [0.7, 0.85] },
  egg: ['#b0582a', '#1d4636'],
  client: { runSpeed: 4 },

  // Hunting
  game: { class: 'small', minEnergy: 150, minShotEnergy: 3, weight: [0.8, 1.5], score: 0, trophy: null },
  senses: { sight: 1.2, hearing: 1.3, smell: 0.4, alertTime: 8, herd: 4 },

  model: { bones: body.bones },
  organs: body.organs,

  // Cock plumage (the default texture is variant 0's).
  materials: {
    body: {
      base: '#b4602c',
      layers: [
        // Grey-green rump above the tail.
        region('#7c8466', all(bone('body'), ({ face: f, p }) => (f === 'top' || f === 'back') && p[2] > ctx.zb - 3)),
        spots('#2a1a10', { size: 1.6, radius: 0.22 }),
        underside('#5a3418', { y: ctx.bottom + 1, soft: 1.2 }),
        mottle(0.08, { scale: 3 }),
        fur(0.06),
      ],
    },
    breast: { base: '#a8441e', layers: [spots('#2a1610', { size: 1.5, radius: 0.22, seed: 9 }), fur(0.06)] },
    // Copper flanks with black spots; sandy wing coverts along the top of the folded wing.
    wing: {
      base: '#b4602c',
      layers: [
        region('#b89060', ({ p, face: f }) => f === 'top' || p[1] > ctx.top - 1.2),
        region('#9a8a68', ({ p }) => p[2] > ctx.zb - 1.5),
        spots('#2a1a10', { size: 1.6, radius: 0.24, seed: 4 }),
        fur(0.06),
      ],
    },
    // White collar at the base of the neck, glossy green above.
    neck: {
      base: '#1f4a3a',
      layers: [
        gradient('#3a2a5a', { axis: 1, from: ctx.top + 1, to: ctx.neckTop + 1 }),
        region('#f2efe6', ({ p }) => p[1] >= ctx.top && p[1] < ctx.top + 1),
        region('#a8441e', ({ p }) => p[1] < ctx.top),
        fur(0.05),
      ],
    },
    // Dark iridescent head with a big red face wattle around the eye.
    head: {
      base: '#174a30',
      layers: [
        gradient('#24304a', { axis: 1, from: h.bottom, to: h.top + 2 }),
        region('#d42a1e', all(faceSide, ({ p }) => p[2] < h.front + 2 && p[1] < h.top - 1 && p[1] > h.bottom)),
        fur(0.05),
      ],
    },
    beak: '#d8cc9a',
    tail: {
      base: '#b89a62',
      layers: [stripes('#3a2614', { axis: 2, period: 1.6, width: 0.35, warp: 0.25 }), gradient('#8a6a40', { axis: 2, from: ctx.zb, to: ctx.zb + 14 }), fur(0.04)],
    },
    leg: '#8a8070',
    foot: '#7a7060',
  },

  anims: birdAnims({ width: 4, swing: 40, walkLength: 0.6, runLength: 0.3, sleepDrop: 3 }),
};
