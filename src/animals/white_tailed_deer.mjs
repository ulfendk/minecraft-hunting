import { extras, quadruped } from '../lib/anim.mjs';
import { cervid } from '../lib/bodies.mjs';
import { all, bone, face, LEGS } from '../lib/parts.mjs';
import { fur, gradient, mottle, region, underside } from '../lib/texture.mjs';

// Antlers: main beams curving forward with three upward tines each.
function antlers(top, z) {
  const cubes = [];
  for (const s of [1, -1]) {
    const x = s > 0 ? 1 : -2, xo = s > 0 ? 3 : -4;
    cubes.push(
      { origin: [x, top, z], size: [1, 3, 1], mat: 'antler' },
      { origin: [s > 0 ? 2 : -3, top + 2, z], size: [1, 1, 1], mat: 'antler' },
      { origin: [xo, top + 2, z - 5], size: [1, 1, 6], mat: 'antler' },
      { origin: [xo, top + 3, z - 1], size: [1, 3, 1], mat: 'antler' },
      { origin: [xo, top + 3, z - 3], size: [1, 3, 1], mat: 'antler' },
      { origin: [xo, top + 3, z - 5], size: [1, 2, 1], mat: 'antler' },
    );
  }
  return cubes;
}

const body = cervid({
  bodyW: 6, bodyH: 7, bodyL: 18, legH: 11, legW: 2,
  neckW: 3, neckH: 9, neckD: 4, neckTilt: 35,
  headW: 4, headH: 4, headD: 4, muzzleW: 3, muzzleH: 3, muzzleD: 3,
  earW: 3, earH: 2, tailL: 4, tailW: 2, antlers,
});

export default {
  id: 'white_tailed_deer',
  name: 'White-tailed Deer',
  role: 'prey',
  family: ['deer', 'cervid', 'game', 'big_game'],
  size: [0.9, 1.5],
  health: 20,
  speed: 0.25,
  panicSpeed: 1.9,
  fleeSpeed: 2.0,
  xp: 4,
  breed: ['wheat', 'apple'],
  tempt: ['apple', 'wheat'],
  grazes: true,
  sleeps: 'night',
  variants: [{ name: 'buck' }, { name: 'doe', weight: 2 }],
  variantsMixed: true,
  maleBones: ['antlers'],
  spawn: [{ biomes: ['forest', 'plains', 'taiga'], weight: 8, group: [2, 5], blocks: ['grass_block', 'podzol'] }],
  loot: [
    { item: 'hunting:raw_venison', min: 2, max: 4 },
    { item: 'hunting:deer_hide', min: 1, max: 1 },
  ],
  sounds: { ambient: 'mob.goat.ambient', hurt: 'mob.goat.hurt', death: 'mob.goat.death', warn: 'mob.goat.ambient', pitch: [0.8, 0.95] },
  egg: ['#9a7454', '#f1ece2'],
  client: { runSpeed: 5 },

  // Hunting
  game: { class: 'medium', minEnergy: 1350, weight: [45, 110], score: 150, trophy: 'trophy_antlers', maleTrophy: true, call: 'deer' },
  senses: { sight: 1.0, hearing: 1.3, smell: 1.5, alertTime: 12, herd: 18 },

  model: { bones: body.bones },
  organs: body.organs,

  materials: {
    hide: {
      base: '#9a7454',
      layers: [
        underside('#efe8dc', { y: 12.5, soft: 1.5, where: bone('body') }),
        region('#efe8dc', all(bone('body'), face('back'), ({ p }) => p[1] < 16)),
        gradient('#7a5a40', { axis: 1, from: 8, to: 2, where: bone(...LEGS) }),
        region('#efe8dc', all(bone('neck'), face('front'), ({ p }) => p[1] < 22)),
        mottle(0.06),
        fur(0.05),
      ],
    },
    face: {
      base: '#8f6b4c',
      layers: [region('#efe8dc', ({ face: f, p }) => (f === 'left' || f === 'right') && p[1] > 26 && p[1] < 27), fur(0.05)],
    },
    muzzle: { base: '#5a4434', layers: [region('#efe8dc', ({ p }) => p[1] < 24.6), fur(0.04)] },
    ear: { base: '#8f6b4c', layers: [region('#efe8dc', ({ face: f }) => f === 'front'), fur(0.05)] },
    tail: { base: '#7a5a40', layers: [region('#ffffff', ({ face: f }) => f === 'back' || f === 'bottom'), fur(0.05)] },
    hoof: '#2a2420',
    antler: { base: '#d8c8a8', layers: [mottle(0.08, { scale: 2 })] },
  },

  anims: {
    ...quadruped({ neck: 'neck', tail: ['tail'], ears: ['ear_l', 'ear_r'], swing: 32, sleepDrop: 6, legFold: 85, walkLength: 0.9, runLength: 0.4 }),
    ...extras.hunting({ neck: 'neck', tail: 'tail', ears: ['ear_l', 'ear_r'], width: 6 }),
  },
};
