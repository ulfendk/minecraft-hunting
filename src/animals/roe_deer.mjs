import { extras, quadruped } from '../lib/anim.mjs';
import { cervid, tine } from '../lib/bodies.mjs';
import { all, bone, face, LEGS } from '../lib/parts.mjs';
import { fur, gradient, mottle, region, underside } from '../lib/texture.mjs';

// Antlers: short, near-upright rough spikes with a knobbly coronet, a forward tine
// halfway up and a backward tine near the top (a six-pointer buck).
function antlers(top, z) {
  const cubes = [];
  for (const s of [1, -1]) {
    const x = s > 0 ? 1 : -2;
    cubes.push(
      { origin: [x, top, z], size: [1, 1, 1], mat: 'coronet', inflate: 0.25 },
      tine([x, top, z], 7, [-6, 0, s * 10]),
      tine([x + s * 0.6, top + 3.5, z], 2, [60, 0, s * 8]),
      tine([x + s * 1.1, top + 5.5, z + 0.5], 2, [-55, 0, s * 8]),
    );
  }
  return cubes;
}

const body = cervid({
  bodyW: 6, bodyH: 7, bodyL: 16, legH: 11, legW: 2,
  neckW: 3, neckH: 9, neckD: 4, neckTilt: 25,
  headW: 4, headH: 4, headD: 4, muzzleW: 3, muzzleH: 3, muzzleD: 3,
  earW: 3, earH: 3, tailL: 1, tailW: 2, antlers,
});
const { zb, headTop } = body.at;

export default {
  id: 'roe_deer',
  name: 'Roe Deer',
  role: 'prey',
  family: ['deer', 'cervid', 'game'],
  scale: 0.78,
  size: [0.6, 1.1],
  health: 12,
  speed: 0.27,
  panicSpeed: 2.0,
  fleeSpeed: 2.1,
  xp: 3,
  breed: ['wheat', 'apple'],
  tempt: ['apple', 'wheat'],
  grazes: true,
  sleeps: 'night',
  variants: [{ name: 'buck' }, { name: 'doe', weight: 2 }],
  variantsMixed: true,
  maleBones: ['antlers'],
  spawn: [{ biomes: ['forest', 'plains'], weight: 8, group: [1, 3], blocks: ['grass_block', 'podzol'] }],
  loot: [
    { item: 'hunting:raw_venison', min: 1, max: 2 },
    { item: 'hunting:deer_hide', min: 0, max: 1 },
  ],
  sounds: { ambient: 'mob.goat.ambient', hurt: 'mob.goat.hurt', death: 'mob.goat.death', warn: 'mob.goat.ambient', pitch: [1.05, 1.25] },
  egg: ['#8e6145', '#f4efe6'],
  client: { runSpeed: 5.5 },

  // Hunting
  game: { class: 'medium', minEnergy: 1000, weight: [15, 35], score: 100, trophy: 'trophy_antlers', maleTrophy: true, call: 'deer' },
  senses: { sight: 1.0, hearing: 1.4, smell: 1.4, alertTime: 10, herd: 8 },

  model: { bones: body.bones },
  organs: body.organs,

  materials: {
    hide: {
      base: '#8e6145',
      layers: [
        gradient('#7a6656', { axis: 1, from: 13, to: 18, where: bone('body', 'neck') }),
        underside('#c9b49a', { y: 11.8, soft: 1.5, where: bone('body') }),
        // Big white rump patch ("target") with no visible tail.
        region('#f4efe6', all(bone('body'), face('back'), ({ p }) => p[1] > 12)),
        region('#f4efe6', all(bone('body'), face('left', 'right', 'top'), ({ p }) => p[2] > zb - 1.6 && p[1] > 13)),
        gradient('#6a4a36', { axis: 1, from: 9, to: 2, where: bone(...LEGS) }),
        mottle(0.06),
        fur(0.05),
      ],
    },
    face: {
      base: '#7d5a42',
      layers: [region('#5e4434', ({ face: f }) => f === 'front' || f === 'top'), fur(0.05)],
    },
    // Black nose with a white band behind it and a white chin.
    muzzle: {
      base: '#6e5442',
      layers: [
        region('#f4efe6', ({ p, face: f }) => f !== 'top' && p[1] < 22),
        region('#f4efe6', ({ p, face: f }) => (f === 'left' || f === 'right') && p[2] > -11 && p[2] < -10 && p[1] > 22.6),
        region('#141010', ({ face: f, p }) => (f === 'front' && p[1] > 22) || (f === 'top' && p[2] < -11)),
        fur(0.04),
      ],
    },
    ear: { base: '#7d5a42', layers: [region('#e8e0d4', ({ face: f }) => f === 'front'), region('#2a2018', ({ p }) => p[1] > headTop + 1.2), fur(0.05)] },
    tail: { base: '#f4efe6', layers: [fur(0.04)] },
    hoof: '#2a2420',
    antler: { base: '#7a6248', layers: [region('#e6dccb', ({ p }) => p[1] > headTop + 5.5), mottle(0.12, { scale: 2 })] },
    coronet: { base: '#6a5440', layers: [mottle(0.2, { scale: 1 })] },
  },

  anims: {
    ...quadruped({ neck: 'neck', tail: ['tail'], ears: ['ear_l', 'ear_r'], swing: 34, sleepDrop: 6, legFold: 85, walkLength: 0.8, runLength: 0.35 }),
    ...extras.hunting({ neck: 'neck', tail: 'tail', ears: ['ear_l', 'ear_r'], width: 6 }),
  },
};
