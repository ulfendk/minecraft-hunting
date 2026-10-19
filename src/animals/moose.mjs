import { extras, quadruped } from '../lib/anim.mjs';
import { cervid } from '../lib/bodies.mjs';
import { all, bone, face, LEGS } from '../lib/parts.mjs';
import { fur, gradient, mottle, region } from '../lib/texture.mjs';

/**
 * Palmate antlers: a short beam out to each side ending in a broad, flat palm that is
 * cupped upward, with a row of points along its outer rim and a smaller brow palm
 * in front.
 */
function antlers(top, z) {
  const cubes = [];
  for (const s of [1, -1]) {
    const X = (n, w = 1) => (s > 0 ? n : -n - w); // n texels out from the midline, w wide
    const inner = 3;
    // Beam: from the skull out to the palm.
    cubes.push({ origin: [X(1, 3), top, z], size: [3, 2, 2], mat: 'antler' });
    // Everything on the palm rotates with it: tilted up towards the outer edge.
    const pivot = [s * (inner + 1), top + 1, z + 1];
    const rotation = [12, 0, -s * 32];
    const palm = (x, y, zz, size) => cubes.push({ origin: [X(x, size[0]), top + 1 + y, z + zz], size, mat: 'antler', rotation, pivot });
    palm(inner, 0, -2, [6, 1, 7]); // main palm
    palm(inner + 2, 0, -5, [3, 1, 3]); // brow palm, forward
    // Points round the rim: outer edge (up), front (forward), back.
    for (const zz of [-2, 0, 2, 4]) palm(inner + 6, 0, zz, [1, 1, 1]);
    for (const zz of [-1, 1, 3]) palm(inner + 6, 1, zz, [1, 2, 1]);
    palm(inner + 5, 1, -2, [1, 1, 1]);
    palm(inner + 2, 0, -6, [1, 1, 1]);
    palm(inner + 4, 0, -6, [1, 1, 1]);
    palm(inner + 4, 1, -5, [1, 1, 1]);
    palm(inner + 3, 0, 5, [2, 1, 1]);
  }
  return cubes;
}

const body = cervid({
  bodyW: 7, bodyH: 8, bodyL: 19, legH: 13, legW: 2, hump: 3,
  neckW: 4, neckH: 9, neckD: 6, neckTilt: 42,
  headW: 5, headH: 5, headD: 5, muzzleW: 4, muzzleH: 4, muzzleD: 6, muzzleDrop: 2,
  earW: 3, earH: 2, tailL: 2, tailW: 2, bell: true, bellW: 2, bellH: 5, antlers,
});

// The long, overhanging upper lip: a droop over the front of the muzzle.
const { muzzle } = body.at;
body.bones.find((b) => b.name === 'head').cubes.push({
  origin: [muzzle.origin[0], muzzle.origin[1] - 1, muzzle.origin[2]], size: [muzzle.size[0], 2, 2], mat: 'muzzle',
  marks: [{ face: 'front', x: 0, y: 0, w: 1, h: 1, color: '#151110' }, { face: 'front', x: 3, y: 0, w: 1, h: 1, color: '#151110' }],
});

export default {
  id: 'moose',
  name: 'Moose',
  role: 'prey',
  family: ['deer', 'cervid', 'game', 'big_game'],
  scale: 1.6,
  size: [1.6, 2.6],
  health: 45,
  speed: 0.23,
  panicSpeed: 1.7,
  fleeSpeed: 1.8,
  xp: 7,
  knockbackResistance: 0.6,
  breed: ['wheat', 'apple'],
  tempt: ['apple', 'wheat'],
  grazes: true,
  sleeps: 'night',
  variants: [{ name: 'bull' }, { name: 'cow', weight: 2 }],
  variantsMixed: true,
  maleBones: ['antlers'],
  spawn: [{ biomes: ['taiga', 'swamp', 'forest'], weight: 3, group: [1, 2], blocks: ['grass_block', 'podzol', 'dirt'] }],
  loot: [
    { item: 'hunting:raw_venison', min: 6, max: 10 },
    { item: 'hunting:deer_hide', min: 2, max: 3 },
  ],
  sounds: { ambient: 'mob.camel.ambient', hurt: 'mob.camel.hurt', death: 'mob.camel.death', warn: 'mob.camel.ambient', pitch: [0.55, 0.65] },
  egg: ['#3a2a20', '#8a7a66'],
  client: { runSpeed: 4.5 },

  // Hunting
  game: { class: 'big', minEnergy: 2700, weight: [300, 700], score: 250, trophy: 'trophy_paddles', maleTrophy: true, call: 'deer' },
  senses: { sight: 0.6, hearing: 1.2, smell: 1.6, alertTime: 10, herd: 6 },

  model: { bones: body.bones },
  organs: body.organs,

  materials: {
    hide: {
      base: '#46342a',
      layers: [
        gradient('#2a1e17', { axis: 1, from: 16, to: 24, where: bone('body') }),
        // Pale grey-brown "stockings" below the knees and hocks.
        gradient('#9a8a74', { axis: 1, from: 10, to: 5, where: bone(...LEGS) }),
        region('#4a3829', all(bone('body'), face('bottom'))),
        mottle(0.08),
        fur(0.06),
      ],
    },
    face: { base: '#54402f', layers: [mottle(0.06, { scale: 2 }), fur(0.05)] },
    muzzle: { base: '#4e3a2e', layers: [gradient('#6a5444', { axis: 2, from: -20, to: -26 }), fur(0.05)] },
    ear: { base: '#45332a', layers: [region('#7a6a58', ({ face: f }) => f === 'front'), fur(0.05)] },
    bell: { base: '#2a1e17', layers: [fur(0.1)] },
    tail: { base: '#46342a', layers: [fur(0.05)] },
    hoof: '#1e1a18',
    antler: { base: '#b9a27e', layers: [mottle(0.12, { scale: 3 }), fur(0.05)] },
  },

  anims: {
    ...quadruped({ neck: 'neck', tail: ['tail'], ears: ['ear_l', 'ear_r'], swing: 28, sleepDrop: 7, legFold: 85, walkLength: 1.2, runLength: 0.55 }),
    ...extras.hunting({ neck: 'neck', tail: 'tail', ears: ['ear_l', 'ear_r'], width: 7 }),
  },
};
