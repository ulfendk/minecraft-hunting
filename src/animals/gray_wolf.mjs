import { extras, quadruped } from '../lib/anim.mjs';
import { canid } from '../lib/mammals.mjs';
import { bone } from '../lib/parts.mjs';
import { fur, gradient, mottle, noise3, region, underside } from '../lib/texture.mjs';

const body = canid({ bodyW: 6, bodyH: 6, bodyL: 14, legH: 8, headW: 5, headH: 5, headD: 4, muzzle: [3, 2, 4], tail: [3, 8, 3], tailRot: 25 });

// Grizzled coat: scattered pale and dark guard-hair tips.
const grizzle = (light, dark) => (c, ctx) => {
  const n = noise3(ctx.p[0] * 1.9, ctx.p[1] * 1.9, ctx.p[2] * 1.9, 9);
  return n < 0.2 ? region(light, () => true)(c, ctx) : n > 0.8 ? region(dark, () => true)(c, ctx) : c;
};

export default {
  id: 'gray_wolf',
  name: 'Grey Wolf',
  role: 'predator',
  family: ['canid', 'predator', 'game'],
  size: [0.7, 0.95],
  health: 20,
  speed: 0.3,
  panicSpeed: 2.0,
  fleeSpeed: 2.1,
  xp: 5,
  breed: ['beef', 'mutton'],
  tempt: ['beef', 'mutton'],
  sleeps: 'day',
  hunts: ['deer', 'hare'],
  attack: { damage: 4, speed: 1.6 },
  variants: [{ name: 'male' }, { name: 'female' }],
  variantsMixed: true,
  spawn: [{ biomes: ['taiga', 'forest', 'mountains'], weight: 3, group: [2, 4], blocks: ['grass_block', 'podzol', 'dirt', 'coarse_dirt'] }],
  loot: [
    { item: 'hunting:pelt', min: 1, max: 1 },
    { item: 'hunting:raw_game_meat', min: 0, max: 1 },
  ],
  sounds: { ambient: 'mob.wolf.whine', hurt: 'mob.wolf.hurt', death: 'mob.wolf.death', warn: 'mob.wolf.growl', pitch: [0.8, 0.95] },
  egg: ['#8a8680', '#4a4642'],
  client: { runSpeed: 6 },

  // Hunting
  game: { class: 'medium', minEnergy: 1000, weight: [30, 60], score: 110, trophy: 'trophy_skull', maleTrophy: false, call: 'predator' },
  senses: { sight: 1.3, hearing: 1.4, smell: 1.6, alertTime: 14, herd: 20 },

  model: { bones: body.bones },
  organs: body.organs,

  materials: {
    hide: {
      base: '#948a7c',
      layers: [
        // Dark saddle over the back, buff flanks, pale belly.
        region('#58524a', ({ p, face: f }) => (f === 'top' || p[1] > 12.5) && p[2] > -3),
        gradient('#a89a82', { axis: 1, from: 12, to: 9, where: bone('body') }),
        underside('#ddd6c8', { y: 9.5, soft: 2, where: bone('body') }),
        mottle(0.1, { scale: 4 }),
        grizzle('#cfc8ba', '#46413b'),
        fur(0.1),
      ],
    },
    ruff: {
      base: '#9a9082',
      layers: [
        region('#6a635a', ({ p, face: f }) => f === 'top' || p[1] > 13.5),
        region('#ddd6c8', ({ face: f, p }) => f === 'bottom' || (f === 'front' && p[1] < 13)),
        grizzle('#d0c9bb', '#5a544c'),
        fur(0.1),
      ],
    },
    leg: { base: '#b4a894', layers: [region('#8c8274', ({ face: f, p }) => f === 'front' && p[1] > 5), gradient('#cfc6b4', { axis: 1, from: 6, to: 1 }), fur(0.08)] },
    paw: '#a89c88',
    face: {
      base: '#8c8478',
      layers: [
        region('#ddd6c8', ({ face: f, p }) => (f === 'left' || f === 'right' || f === 'front') && p[1] < 13.5),
        region('#6a635a', ({ face: f }) => f === 'top'),
        grizzle('#9a9286', '#5e5850'),
        fur(0.06),
      ],
    },
    muzzle: { base: '#9a9286', layers: [region('#e2dccf', ({ face: f, p }) => f === 'bottom' || p[1] < 12), region('#6a645c', ({ face: f }) => f === 'top'), fur(0.06)] },
    ear: { base: '#6a645c', layers: [region('#ddd6c8', ({ face: f, j }) => f === 'front' && j > 0), region('#3a3632', ({ face: f, j }) => f !== 'front' && j === 0), fur(0.06)] },
    tail: { base: '#8c8478', layers: [gradient('#2a2826', { axis: 1, from: 8, to: 5 }), region('#c8c0b2', ({ face: f, p }) => f === 'front' && p[1] > 8), grizzle('#b8b0a2', '#4a4642'), fur(0.08)] },
  },

  anims: {
    ...quadruped({ tail: ['tail'], ears: ['ear_l', 'ear_r'], swing: 34, sleepDrop: 6, legFold: 85, walkLength: 0.8, runLength: 0.35 }),
    ...extras.hunting({ tail: 'tail', ears: ['ear_l', 'ear_r'], width: 6 }),
  },
};
