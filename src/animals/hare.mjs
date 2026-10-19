import { extras, quadruped } from '../lib/anim.mjs';
import { bound, leporid } from '../lib/mammals.mjs';
import { bone } from '../lib/parts.mjs';
import { fur, gradient, mottle, noise3, region, underside } from '../lib/texture.mjs';

const body = leporid();

// Agouti coat: dark-tipped speckles.
const speckle = (color, amount) => region(color, ({ p }) => noise3(p[0] * 4.1, p[1] * 4.1, p[2] * 4.1, 13) < amount);

export default {
  id: 'hare',
  name: 'Hare',
  role: 'prey',
  family: ['hare', 'small_game', 'game'],
  size: [0.5, 0.6],
  health: 6,
  speed: 0.3,
  panicSpeed: 2.2,
  fleeSpeed: 2.3,
  xp: 2,
  movement: 'hop',
  breed: ['carrot', 'dandelion'],
  tempt: ['carrot', 'golden_carrot', 'dandelion'],
  grazes: true,
  sleeps: 'day',
  variants: [{ name: 'buck' }, { name: 'doe' }],
  variantsMixed: true,
  spawn: [{ biomes: ['plains', 'forest'], weight: 6, group: [1, 2], blocks: ['grass_block', 'dirt', 'coarse_dirt'] }],
  loot: [
    { item: 'rabbit', min: 1, max: 1 },
    { item: 'rabbit_hide', min: 0, max: 1 },
  ],
  sounds: { ambient: 'mob.rabbit.idle', hurt: 'mob.rabbit.hurt', death: 'mob.rabbit.death', warn: 'mob.rabbit.idle', pitch: [0.8, 0.95] },
  egg: ['#9a7650', '#f0eadc'],
  client: { runSpeed: 6 },

  // Hunting
  game: { class: 'small', minEnergy: 200, minShotEnergy: 3, weight: [2.5, 5], score: 0, trophy: null },
  senses: { sight: 1.0, hearing: 1.6, smell: 1.0, alertTime: 8, herd: 0 },

  model: { bones: body.bones },
  organs: body.organs,

  materials: {
    hide: {
      base: '#9c7a52',
      layers: [
        gradient('#b08c60', { axis: 1, from: 7, to: 5 }),
        underside('#f2ece0', { y: 4.6, soft: 1, where: bone('body') }),
        region('#f2ece0', ({ face: f, p }) => f === 'front' && p[1] < 6),
        speckle('#6a5038', 0.2),
        mottle(0.08, { scale: 3 }),
        fur(0.1),
      ],
    },
    leg: { base: '#a8885e', layers: [region('#e8e0d0', ({ face: f }) => f === 'back' || f === 'bottom'), fur(0.08)] },
    paw: '#c8bca8',
    face: {
      base: '#a07e56',
      layers: [
        region('#e8dcc8', ({ face: f, p }) => (f === 'left' || f === 'right') && p[1] > 9 && p[1] < 10),
        speckle('#7a5e42', 0.15),
        fur(0.08),
      ],
    },
    muzzle: { base: '#b0906a', layers: [region('#efe6d6', ({ face: f, p }) => f === 'bottom' || p[1] < 7.5)] },
    ear: {
      base: '#a07e56',
      layers: [
        region('#d8c4a4', ({ face: f, p, j }) => f === 'front' && Math.abs(p[0]) < 1.5 && j > 1),
        // Black tips.
        region('#151210', ({ j, face: f }) => (f === 'top') || (f !== 'bottom' && j < 2)),
        fur(0.06),
      ],
    },
    tail: { base: '#f4efe6', layers: [region('#161210', ({ face: f, p }) => f === 'top' || (f === 'back' && p[1] > 8))] },
  },

  anims: {
    ...quadruped({ tail: ['tail'], ears: ['ear_l', 'ear_r'], swing: 30, sleepDrop: 3, legFold: 80, walkLength: 0.5, runLength: 0.35 }),
    ...bound({ walkLength: 0.5, runLength: 0.35 }),
    ...extras.hunting({ tail: 'tail', ears: ['ear_l', 'ear_r'], width: 4 }),
  },
};
