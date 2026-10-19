import { extras, quadruped } from '../lib/anim.mjs';
import { canid } from '../lib/mammals.mjs';
import { bone } from '../lib/parts.mjs';
import { fur, gradient, mottle, region, underside } from '../lib/texture.mjs';

const body = canid({
  bodyW: 6, bodyH: 5, bodyL: 12, legH: 4, ruff: false,
  headW: 6, headH: 4, headD: 4, muzzle: [2, 2, 3], ear: [2, 4, 1], earX: 1,
  tail: [3, 9, 3], tailRot: 55, headUp: 1,
});

export default {
  id: 'red_fox',
  name: 'Red Fox',
  role: 'predator',
  family: ['canid', 'vulpine', 'predator', 'game', 'small_game'],
  size: [0.6, 0.6],
  scale: 0.85,
  health: 10,
  speed: 0.3,
  panicSpeed: 2.1,
  fleeSpeed: 2.2,
  xp: 3,
  breed: ['chicken', 'sweet_berries'],
  tempt: ['chicken', 'sweet_berries'],
  sleeps: 'day',
  hunts: ['hare', 'game_bird'],
  attack: { damage: 2, speed: 1.6 },
  variants: [{ name: 'dog' }, { name: 'vixen' }],
  variantsMixed: true,
  spawn: [{ biomes: ['forest', 'plains', 'taiga'], weight: 4, group: [1, 2], blocks: ['grass_block', 'podzol', 'dirt', 'coarse_dirt'] }],
  loot: [{ item: 'hunting:pelt', min: 1, max: 1 }],
  sounds: { ambient: 'mob.fox.ambient', hurt: 'mob.fox.hurt', death: 'mob.fox.death', warn: 'mob.fox.screech', pitch: [0.95, 1.1] },
  egg: ['#c8601e', '#f2ece0'],
  client: { runSpeed: 6 },

  // Hunting
  game: { class: 'small', minEnergy: 400, minShotEnergy: 4, weight: [4, 8], score: 60, trophy: 'trophy_skull', maleTrophy: false, call: 'predator' },
  senses: { sight: 1.1, hearing: 1.5, smell: 1.5, alertTime: 10, herd: 0 },

  model: { bones: body.bones },
  organs: body.organs,

  materials: {
    hide: {
      base: '#c8601e',
      layers: [
        gradient('#a84a16', { axis: 1, from: 6, to: 9, where: bone('body') }),
        underside('#f0e8dc', { y: 5.5, soft: 1.5, where: bone('body') }),
        // White chest.
        region('#f0e8dc', ({ face: f, p }) => f === 'front' && p[1] < 8),
        mottle(0.08, { scale: 4 }),
        fur(0.08),
      ],
    },
    // Black stockings.
    leg: { base: '#1e1814', layers: [region('#b05420', ({ p }) => p[1] > 4), fur(0.08)] },
    paw: '#141010',
    face: {
      base: '#c8601e',
      layers: [
        region('#f2ece0', ({ face: f, p }) => (f === 'left' || f === 'right' || f === 'front' || f === 'bottom') && p[1] < 8.5),
        region('#a84a16', ({ face: f }) => f === 'top'),
        fur(0.06),
      ],
    },
    muzzle: { base: '#c8601e', layers: [region('#f2ece0', ({ face: f, p }) => f === 'bottom' || p[1] < 8), fur(0.05)] },
    ear: { base: '#1a1412', layers: [region('#c8601e', ({ face: f, j }) => f === 'front' && j > 0), region('#f2ece0', ({ face: f, j, p }) => f === 'front' && j > 1 && Math.abs(p[0]) < 2)] },
    tail: {
      base: '#c25c1e',
      layers: [gradient('#8a4416', { axis: 1, from: 6, to: 2 }), region('#f4efe6', ({ p, face: f }) => p[1] < 2.5 || (f === 'bottom' && p[1] < 4)), mottle(0.08, { scale: 3 }), fur(0.1)],
    },
  },

  anims: {
    ...quadruped({ tail: ['tail'], ears: ['ear_l', 'ear_r'], swing: 34, sleepDrop: 3, legFold: 85, walkLength: 0.7, runLength: 0.3 }),
    ...extras.hunting({ tail: 'tail', ears: ['ear_l', 'ear_r'], width: 6 }),
  },
};
