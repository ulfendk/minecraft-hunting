import { fish } from '../lib/anim.mjs';
import { fishBody } from '../lib/bodies.mjs';
import { fur, gradient, mottle, region, underside } from '../lib/texture.mjs';

const body = fishBody({
  bodyW: 6, bodyH: 7, bodyL: 14, headW: 5, headH: 6, headL: 5, tailW: 2, tailH: 3, tailL: 6,
  caudalH: 11, caudalL: 3, dorsalH: 3, dorsalL: 3, dorsal2: 3, pectoral: 4, lift: 1,
});
const { at } = body;

export default {
  id: 'bluefin_tuna',
  name: 'Bluefin Tuna',
  role: 'prey',
  family: ['bluefin_tuna', 'fish', 'game', 'big_game'],
  size: [1.0, 0.65],
  scale: 1.4,
  health: 30,
  speed: 0.14,
  movement: 'swim',
  swimSpeed: 0.2,
  school: true,
  panicSpeed: 2.0,
  fleeSpeed: 2.2,
  xp: 6,
  knockbackResistance: 0.4,
  sleeps: 'never',
  spawn: [{ biomes: ['deep_ocean', 'lukewarm_ocean'], weight: 3, group: [2, 4], water: true, height: [30, 60] }],
  loot: [
    { item: 'hunting:raw_fish_fillet', min: 6, max: 10 },
    { item: 'bone_meal', min: 1, max: 3 },
  ],
  sounds: { hurt: 'mob.fish.hurt', death: 'mob.fish.death', pitch: [0.55, 0.65] },
  egg: ['#1c2c4a', '#c8d0d8'],
  client: { noLook: true },

  // Hunting
  game: { class: 'big', minEnergy: 400, minShotEnergy: 40, weight: [80, 320], score: 120, trophy: 'trophy_tuna' },
  senses: { sight: 1.3, hearing: 1.2, smell: 0.1, alertTime: 6, herd: 10 },

  model: { bones: body.bones },
  organs: body.organs,

  materials: {
    scales: {
      base: '#8c98a6',
      layers: [
        gradient('#13234a', { axis: 1, from: at.cy - 0.5, to: at.top - 0.5 }),
        underside('#e2e6ea', { y: at.bottom + 2, soft: 1.5 }),
        // Yellow finlets along the tail.
        region('#e0c040', ({ cube, p }) => cube.bone === 'tail' && (p[1] > at.cy + 1 || p[1] < at.cy - 1)),
        mottle(0.05, { scale: 3 }),
        fur(0.04),
      ],
    },
    head: {
      base: '#8c98a6',
      layers: [
        gradient('#13234a', { axis: 1, from: at.cy - 0.5, to: at.top - 0.5 }),
        underside('#dfe3e8', { y: at.bottom + 2, soft: 1.5 }),
      ],
    },
    fin: '#2a3550',
  },

  anims: fish({ caudal: 'caudal_fin', fins: ['fin_l', 'fin_r'], swimLength: 0.45, amp: 18 }),
};
