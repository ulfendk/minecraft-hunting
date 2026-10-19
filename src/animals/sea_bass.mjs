import { fish } from '../lib/anim.mjs';
import { fishBody } from '../lib/bodies.mjs';
import { fur, gradient, mottle, region, spots, underside } from '../lib/texture.mjs';

const body = fishBody({
  bodyW: 3, bodyH: 4, bodyL: 8, headW: 3, headH: 4, headL: 3, tailW: 2, tailH: 2, tailL: 3,
  caudalH: 5, caudalL: 2, dorsalH: 2, dorsalL: 3, dorsal2: 2, pectoral: 2, lift: 1,
});
const { at } = body;

export default {
  id: 'sea_bass',
  name: 'Sea Bass',
  role: 'prey',
  family: ['sea_bass', 'fish', 'game', 'small_game'],
  size: [0.6, 0.45],
  health: 6,
  speed: 0.12,
  movement: 'swim',
  swimSpeed: 0.14,
  school: true,
  panicSpeed: 1.8,
  fleeSpeed: 2.0,
  xp: 2,
  sleeps: 'never',
  spawn: [{ biomes: ['ocean', 'lukewarm_ocean'], weight: 8, group: [3, 6], water: true, height: [40, 62] }],
  loot: [
    { item: 'hunting:raw_fish_fillet', min: 1, max: 2 },
    { item: 'bone_meal', min: 0, max: 1 },
  ],
  sounds: { hurt: 'mob.fish.hurt', death: 'mob.fish.death', pitch: [1.0, 1.15] },
  egg: ['#7c8a96', '#e8ecef'],
  client: { noLook: true },

  // Hunting
  game: { class: 'small', minEnergy: 60, minShotEnergy: 4, weight: [1.5, 6], score: 0, trophy: null },
  senses: { sight: 0.9, hearing: 1.3, smell: 0.1, alertTime: 6, herd: 6 },

  model: { bones: body.bones },
  organs: body.organs,

  materials: {
    scales: {
      base: '#a8b4bc',
      layers: [
        gradient('#4e5d6a', { axis: 1, from: at.cy, to: at.top }),
        underside('#eef2f2', { y: at.bottom + 1.4, soft: 1.2 }),
        spots('#3a4652', { size: 1.4, radius: 0.18, where: ({ p }) => p[1] > at.cy }),
        mottle(0.06, { scale: 2 }),
        fur(0.05),
      ],
    },
    head: {
      base: '#9aa6b0',
      layers: [
        gradient('#4e5d6a', { axis: 1, from: at.cy, to: at.top }),
        underside('#e6eaea', { y: at.bottom + 1.2, soft: 1 }),
        // The dark spot on the gill cover.
        region('#2e3640', ({ face: f, p }) => (f === 'left' || f === 'right') && p[2] > at.zf - 1 && p[1] > at.cy && p[1] < at.cy + 1),
      ],
    },
    fin: '#6e7a84',
  },

  anims: fish({ caudal: 'caudal_fin', fins: ['fin_l', 'fin_r'], swimLength: 0.5 }),
};
