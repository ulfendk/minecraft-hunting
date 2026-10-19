import { extras, quadruped } from '../lib/anim.mjs';
import { cervid } from '../lib/bodies.mjs';
import { all, bone, face, LEGS } from '../lib/parts.mjs';
import { fur, gradient, mottle, region, underside } from '../lib/texture.mjs';

const deg = Math.PI / 180;

/**
 * A 1x1 antler rod from point `from` (the centre of its base), leaning back by `back`
 * degrees and out to the side by `out` (negative `back` leans forward). Returns the cube
 * and the point at its tip, so the next rod can start there.
 */
function rod(from, len, back, out) {
  const b = back * deg, o = out * deg;
  const tip = [from[0] + Math.sin(o) * Math.cos(b) * len, from[1] + Math.cos(o) * Math.cos(b) * len, from[2] + Math.sin(b) * len];
  const cube = { origin: [from[0] - 0.5, from[1], from[2] - 0.5], size: [1, len, 1], mat: 'antler', rotation: [-back, 0, out], pivot: [...from] };
  return { cube, tip };
}
const along = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// Antlers: long beams sweeping up, out and back in a wide "lyre", with brow, bez and
// trez tines forward and a crown of tines at the top (a "royal" stag).
function antlers(top, z) {
  const cubes = [];
  for (const s of [1, -1]) {
    const base = [s * 1.5, top - 0.5, z + 0.5];
    const beam1 = rod(base, 8, 25, s * 38);
    const beam2 = rod(beam1.tip, 6, 8, s * 12);
    cubes.push(beam1.cube, beam2.cube);
    cubes.push(rod(along(base, beam1.tip, 0.15), 5, -72, s * 12).cube); // brow
    cubes.push(rod(along(base, beam1.tip, 0.38), 4, -62, s * 16).cube); // bez
    cubes.push(rod(beam1.tip, 4, -50, s * 22).cube); // trez
    cubes.push(rod(beam2.tip, 3, -35, s * 35).cube); // crown
    cubes.push(rod(beam2.tip, 3, 0, s * 2).cube);
    cubes.push(rod(beam2.tip, 3, 40, s * 30).cube);
  }
  return cubes;
}

const body = cervid({
  bodyW: 6, bodyH: 8, bodyL: 19, legH: 11, legW: 2,
  neckW: 4, neckH: 9, neckD: 5, neckTilt: 35,
  headW: 4, headH: 4, headD: 4, muzzleW: 3, muzzleH: 3, muzzleD: 4,
  earW: 3, earH: 2, tailL: 2, tailW: 2, antlers,
});

// Stags grow a shaggy, darker mane on the throat and the front of the neck in the rut.
const { neck, top, zf } = body.at;
body.bones.splice(body.bones.findIndex((b) => b.name === 'head'), 0, {
  name: 'mane', parent: 'neck', pivot: [0, top - 2, zf + 2],
  cubes: [
    { origin: [neck.origin[0], neck.origin[1], neck.origin[2]], size: [neck.size[0], 6, neck.size[2]], inflate: 0.5, mat: 'mane', zone: 'neck' },
    { origin: [-1.5, neck.origin[1] - 1, neck.origin[2] - 1], size: [3, 6, 1], mat: 'mane', zone: 'neck' },
  ],
});

export default {
  id: 'red_deer',
  name: 'Red Deer',
  role: 'prey',
  family: ['deer', 'cervid', 'game', 'big_game'],
  scale: 1.25,
  size: [1.1, 1.9],
  health: 28,
  speed: 0.25,
  panicSpeed: 1.8,
  fleeSpeed: 1.9,
  xp: 5,
  breed: ['wheat', 'apple'],
  tempt: ['apple', 'wheat'],
  grazes: true,
  sleeps: 'night',
  variants: [{ name: 'stag' }, { name: 'hind', weight: 2 }],
  variantsMixed: true,
  maleBones: ['antlers', 'mane'],
  spawn: [{ biomes: ['forest', 'taiga', 'mountains', 'plains'], weight: 6, group: [3, 6], blocks: ['grass_block', 'podzol'] }],
  loot: [
    { item: 'hunting:raw_venison', min: 3, max: 6 },
    { item: 'hunting:deer_hide', min: 1, max: 2 },
  ],
  sounds: { ambient: 'mob.goat.ambient', hurt: 'mob.goat.hurt', death: 'mob.goat.death', warn: 'mob.cow.say', pitch: [0.55, 0.7] },
  egg: ['#7e4b33', '#d9c3a0'],
  client: { runSpeed: 5 },

  // Hunting
  game: { class: 'big', minEnergy: 2000, weight: [90, 240], score: 200, trophy: 'trophy_antlers', maleTrophy: true, call: 'deer' },
  senses: { sight: 1.1, hearing: 1.2, smell: 1.4, alertTime: 14, herd: 24 },

  model: { bones: body.bones },
  organs: body.organs,

  materials: {
    hide: {
      base: '#7e4b33',
      layers: [
        underside('#6e4a33', { y: 12.5, soft: 1.5, where: bone('body') }),
        // Pale straw-coloured rump patch around the short tail.
        region('#d9c3a0', all(bone('body'), face('back'), ({ p }) => p[1] > 13 && Math.abs(p[0]) < 2.5)),
        region('#d9c3a0', all(bone('body'), face('top'), ({ p }) => p[2] > 7.5 && Math.abs(p[0]) < 2.5)),
        gradient('#5e3a26', { axis: 1, from: 9, to: 2, where: bone(...LEGS) }),
        gradient('#6e5040', { axis: 1, from: 20, to: 26, where: bone('neck') }),
        mottle(0.07),
        fur(0.05),
      ],
    },
    mane: { base: '#4e3324', layers: [mottle(0.1, { scale: 2 }), fur(0.1)] },
    face: {
      base: '#7a5038',
      layers: [region('#d9c3a0', ({ face: f, p }) => (f === 'left' || f === 'right') && p[1] > 26 && p[1] < 27), fur(0.05)],
    },
    muzzle: { base: '#6e4a36', layers: [region('#d9c3a0', ({ p, face: f }) => f !== 'front' && p[1] < 24.6), fur(0.04)] },
    ear: { base: '#7a5038', layers: [region('#d9c3a0', ({ face: f }) => f === 'front'), fur(0.05)] },
    tail: { base: '#c9b08a', layers: [fur(0.05)] },
    hoof: '#2a2420',
    antler: { base: '#a08668', layers: [region('#e8dcc4', ({ p }) => p[1] > 40), mottle(0.1, { scale: 2 })] },
  },

  anims: {
    ...quadruped({ neck: 'neck', tail: ['tail'], ears: ['ear_l', 'ear_r'], swing: 30, sleepDrop: 6, legFold: 85, walkLength: 1.0, runLength: 0.45 }),
    ...extras.hunting({ neck: 'neck', tail: 'tail', ears: ['ear_l', 'ear_r'], width: 6 }),
  },
};
