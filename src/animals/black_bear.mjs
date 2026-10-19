import { extras, quadruped } from '../lib/anim.mjs';
import { ursid } from '../lib/mammals.mjs';
import { bone } from '../lib/parts.mjs';
import { fur, gradient, mottle, region } from '../lib/texture.mjs';

const body = ursid();

export default {
  id: 'black_bear',
  name: 'Black Bear',
  role: 'predator',
  family: ['ursid', 'bear', 'game', 'big_game'],
  size: [1.3, 1.4],
  scale: 1.25,
  health: 40,
  speed: 0.22,
  panicSpeed: 1.6,
  fleeSpeed: 1.7,
  xp: 10,
  breed: ['sweet_berries', 'honeycomb'],
  tempt: ['sweet_berries', 'honeycomb'],
  sleeps: 'night',
  attack: { damage: 8, speed: 1.4 },
  hostile: { range: 5 },
  knockbackResistance: 0.5,
  variants: [{ name: 'boar' }, { name: 'sow' }],
  variantsMixed: true,
  spawn: [{ biomes: ['forest', 'taiga', 'mountains'], weight: 2, group: [1, 1], blocks: ['grass_block', 'podzol', 'dirt', 'coarse_dirt'] }],
  loot: [
    { item: 'hunting:raw_game_meat', min: 3, max: 6 },
    { item: 'hunting:pelt', min: 1, max: 2 },
  ],
  sounds: { ambient: 'mob.polarbear.idle', hurt: 'mob.polarbear.hurt', death: 'mob.polarbear.death', warn: 'mob.polarbear.warning', pitch: [0.7, 0.85] },
  egg: ['#1c1a1a', '#a07850'],
  client: { runSpeed: 4 },

  // Hunting
  game: { class: 'dangerous', minEnergy: 2700, weight: [60, 270], score: 200, trophy: 'trophy_skull', maleTrophy: false, call: 'predator' },
  senses: { sight: 0.7, hearing: 1.1, smell: 1.8, alertTime: 10, herd: 0 },

  model: { bones: body.bones },
  organs: body.organs,

  materials: {
    hide: { base: '#28221f', layers: [mottle(0.18, { scale: 5 }), gradient('#171515', { axis: 1, from: 10, to: 6, where: bone('body') }), fur(0.18)] },
    leg: { base: '#1d1a1a', layers: [fur(0.16)] },
    paw: { base: '#141212', layers: [region('#3a3533', ({ face: f, i }) => f === 'front' && i % 2 === 0)] },
    face: { base: '#262221', layers: [region('#5a4232', ({ face: f, p }) => f === 'front' && p[1] < 11), fur(0.16)] },
    muzzle: { base: '#9a7450', layers: [gradient('#7a5a3e', { axis: 1, from: 12, to: 9 }), fur(0.08)] },
    nose: '#151212',
    ear: { base: '#1e1b1a', layers: [fur(0.12)] },
    tail: { base: '#1e1b1a', layers: [fur(0.12)] },
  },

  anims: {
    ...quadruped({ tail: ['tail'], ears: ['ear_l', 'ear_r'], swing: 24, sleepDrop: 4, legFold: 80, walkLength: 1.2, runLength: 0.5 }),
    ...extras.hunting({ tail: 'tail', ears: ['ear_l', 'ear_r'], width: 12 }),
  },
};
