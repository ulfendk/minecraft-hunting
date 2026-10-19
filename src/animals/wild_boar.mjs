import { extras, quadruped } from '../lib/anim.mjs';
import { suid } from '../lib/mammals.mjs';
import { bone } from '../lib/parts.mjs';
import { fur, gradient, mottle, noise3, region } from '../lib/texture.mjs';

// Grizzled coat: scattered lighter hair tips.
const grizzle = (color, amount) => region(color, ({ p }) => noise3(p[0] * 1.7, p[1] * 1.7, p[2] * 1.7, 5) < amount);

const body = suid();

export default {
  id: 'wild_boar',
  name: 'Wild Boar',
  role: 'prey',
  family: ['suid', 'game', 'big_game'],
  size: [0.9, 1.0],
  health: 24,
  speed: 0.25,
  panicSpeed: 1.8,
  fleeSpeed: 1.9,
  xp: 5,
  breed: ['carrot', 'potato', 'beetroot'],
  tempt: ['carrot', 'potato', 'beetroot'],
  grazes: true,
  sleeps: 'day',
  attack: { damage: 5, speed: 1.5 },
  knockbackResistance: 0.3,
  variants: [{ name: 'boar' }, { name: 'sow', weight: 2 }],
  variantsMixed: true,
  spawn: [{ biomes: ['forest', 'taiga', 'swamp'], weight: 6, group: [2, 5], blocks: ['grass_block', 'podzol', 'dirt', 'coarse_dirt'] }],
  loot: [
    { item: 'hunting:raw_game_meat', min: 2, max: 5 },
    { item: 'hunting:pelt', min: 0, max: 1 },
  ],
  sounds: { ambient: 'mob.hoglin.ambient', hurt: 'mob.hoglin.hurt', death: 'mob.hoglin.death', warn: 'mob.hoglin.angry', pitch: [1.0, 1.15] },
  egg: ['#4a4038', '#7a6a5a'],
  client: { runSpeed: 5 },

  // Hunting
  game: { class: 'medium', minEnergy: 1600, weight: [50, 180], score: 120, trophy: 'trophy_tusks', maleTrophy: false },
  senses: { sight: 0.6, hearing: 1.2, smell: 1.7, alertTime: 12, herd: 10 },

  model: { bones: body.bones },
  organs: body.organs,

  materials: {
    hide: {
      base: '#5e5245',
      layers: [
        mottle(0.14, { scale: 4 }),
        gradient('#3a322b', { axis: 1, from: 11, to: 6, where: bone('body') }),
        region('#463c33', ({ p }) => p[2] < -4 && p[1] > 9),
        grizzle('#857563', 0.22),
        fur(0.14),
      ],
    },
    leg: { base: '#3e3630', layers: [gradient('#262220', { axis: 1, from: 6, to: 1 }), fur(0.12)] },
    bristle: { base: '#2e2823', layers: [grizzle('#5a4e42', 0.3), fur(0.2)] },
    cheek: { base: '#6a5e50', layers: [grizzle('#8a7c6a', 0.3), fur(0.15)] },
    face: { base: '#4e443a', layers: [grizzle('#7a6c5c', 0.2), fur(0.14)] },
    snout: { base: '#3c342e', layers: [gradient('#2a2420', { axis: 2, from: -13, to: -18 }), fur(0.1)] },
    disc: { base: '#6e5a52', layers: [region('#5a4842', ({ face: f }) => f !== 'front'), fur(0.06)] },
    tusk: { base: '#efe8d6', layers: [region('#cfc4a8', ({ p }) => p[1] < 9)] },
    ear: { base: '#5a4e42', layers: [region('#2e2620', ({ face: f, i, j, fw }) => f === 'front' && j > 0 && i > 0 && i < fw - 1 || f === 'front' && fw < 3 && j > 0), grizzle('#7a6c5c', 0.25), fur(0.12)] },
    tail: { base: '#3a322c', layers: [fur(0.1)] },
    paw: '#1e1a18',
  },

  anims: {
    ...quadruped({ tail: ['tail'], ears: ['ear_l', 'ear_r'], swing: 30, sleepDrop: 4, legFold: 85, walkLength: 0.8, runLength: 0.35 }),
    ...extras.hunting({ tail: 'tail', ears: ['ear_l', 'ear_r'], width: 8 }),
  },
};
