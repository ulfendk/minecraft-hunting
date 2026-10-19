import { fish } from '../lib/anim.mjs';
import { fishBody } from '../lib/bodies.mjs';
import { fur, gradient, mottle, region, underside } from '../lib/texture.mjs';

const body = fishBody({
  bodyW: 6, bodyH: 7, bodyL: 16, headW: 5, headH: 6, headL: 6, jaw: true, teeth: true, tailW: 3, tailH: 4, tailL: 7,
  caudalH: 11, caudalL: 4, dorsalH: 5, dorsalL: 4, dorsal2: 0, pectoral: 6, lift: 1,
});
const { at } = body;

export default {
  id: 'porbeagle',
  name: 'Porbeagle Shark',
  role: 'predator',
  family: ['porbeagle', 'shark', 'fish', 'game', 'big_game'],
  size: [1.0, 0.65],
  scale: 1.5,
  health: 40,
  speed: 0.14,
  movement: 'swim',
  swimSpeed: 0.18,
  fleeSpeed: 1.8,
  xp: 10,
  knockbackResistance: 0.5,
  sleeps: 'never',
  hunts: ['sea_bass', 'cod', 'salmon'],
  huntRange: 16,
  huntInterval: 60,
  attack: { damage: 6, speed: 1.6, cooldown: 1.2 },
  // A wounded or bleeding swimmer nearby is fair game.
  hostile: {
    range: 12,
    filters: [
      { test: 'in_water', subject: 'other', value: true },
      { test: 'actor_health', subject: 'other', operator: '<', value: 14 },
    ],
  },
  spawn: [{ biomes: ['deep_ocean', 'cold_ocean'], weight: 1, group: [1, 1], water: true, height: [25, 60] }],
  loot: [
    { item: 'hunting:raw_fish_fillet', min: 4, max: 8 },
    { item: 'bone_meal', min: 1, max: 2 },
  ],
  sounds: { hurt: 'mob.fish.hurt', death: 'mob.fish.death', pitch: [0.5, 0.6] },
  egg: ['#45505c', '#d8dcdf'],
  client: { noLook: true },

  // Hunting
  game: { class: 'dangerous', minEnergy: 500, minShotEnergy: 60, weight: [90, 230], score: 150, trophy: 'trophy_shark_jaw' },
  senses: { sight: 1.0, hearing: 1.4, smell: 1.6, alertTime: 4, herd: 0 },

  model: { bones: body.bones },
  organs: body.organs,

  materials: {
    scales: {
      base: '#5a6672',
      layers: [
        gradient('#353f4a', { axis: 1, from: at.cy, to: at.top }),
        underside('#e4e7ea', { y: at.bottom + 2.2, soft: 1.2 }),
        mottle(0.05, { scale: 3 }),
        fur(0.04),
      ],
    },
    head: {
      base: '#56626e',
      layers: [
        gradient('#353f4a', { axis: 1, from: at.cy, to: at.top }),
        underside('#e4e7ea', { y: at.bottom + 2.2, soft: 1.2 }),
        // Gill slits.
        region('#2a323a', ({ face: f, p }) => (f === 'left' || f === 'right') && p[2] > at.zf - 1.6 && Math.round(p[2] * 2) % 2 === 0),
      ],
    },
    teeth: { base: '#d8d2c8', layers: [region('#f4f2ec', ({ face: f }) => f === 'front' || f === 'top')] },
    // The white patch at the back of the first dorsal fin is the porbeagle's mark.
    fin: { base: '#3e4853', layers: [region('#d8dcdf', ({ cube, p }) => cube.bone === 'dorsal_fin' && p[1] < at.top + 2.5 && p[2] > at.zf + 6.5)] },
  },

  anims: fish({ jaw: 'jaw', caudal: 'caudal_fin', fins: ['fin_l', 'fin_r'], swimLength: 0.8, amp: 16 }),
};
