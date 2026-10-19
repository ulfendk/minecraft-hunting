import { quadruped } from '../lib/anim.mjs';
import { all, bone, eyes, face, legs4 } from '../lib/parts.mjs';
import { fur, mottle, region, spots, underside } from '../lib/texture.mjs';

// A German shorthaired pointer: liver head and patches on a white, ticked coat.
const fam = (value) => ({ test: 'is_family', subject: 'other', value });

export default {
  id: 'hunting_dog',
  name: 'Hunting Dog',
  role: 'companion',
  companion: true,
  family: ['dog', 'hunting_dog'],
  size: [0.6, 0.85],
  health: 24,
  speed: 0.3,
  xp: 2,
  sleeps: 'never',
  attack: { damage: 4, speed: 1.3 },
  noDespawn: true,
  tameBones: ['collar'],
  spawn: [{ biomes: ['plains', 'forest'], weight: 1, group: [1, 1], blocks: ['grass_block'] }],
  loot: [],
  sounds: { ambient: 'mob.wolf.bark', hurt: 'mob.wolf.hurt', death: 'mob.wolf.death', pitch: [1.05, 1.2], interval: 30 },
  egg: ['#f2eee6', '#6a3a22'],
  client: { runSpeed: 5 },

  spawnGroups: ['hunting:dog_wild'],
  extraGroups: {
    'hunting:dog_wild': {
      'minecraft:despawn': { despawn_from_distance: {} },
      'minecraft:tameable': {
        probability: 0.34,
        tame_items: ['hunting:raw_venison', 'hunting:raw_game_meat', 'bone'],
        tame_event: { event: 'hunting:on_tame', target: 'self' },
      },
    },
    'hunting:dog_tame': {
      'minecraft:is_tamed': {},
      'minecraft:sittable': {},
      'minecraft:behavior.stay_while_sitting': { priority: 3 },
      'minecraft:behavior.follow_owner': { priority: 4, speed_multiplier: 1.1, start_distance: 10, stop_distance: 2 },
      'minecraft:behavior.owner_hurt_by_target': { priority: 1 },
      'minecraft:behavior.owner_hurt_target': { priority: 2 },
      'minecraft:healable': { items: [{ item: 'hunting:raw_venison', heal_amount: 8 }, { item: 'hunting:cooked_venison', heal_amount: 12 }, { item: 'hunting:raw_game_meat', heal_amount: 6 }] },
    },
    // Sent off by a dog whistle (scripts/dog.js): find the nearest wounded or downed game.
    'hunting:dog_tracking': {
      'minecraft:behavior.nearest_attackable_target': {
        priority: 1, must_see: false, reselect_targets: true, within_radius: 160,
        entity_types: [{
          filters: { all_of: [fam('hunting_game'), { test: 'int_property', subject: 'other', domain: 'hunting:state', operator: '>=', value: 3 }] },
          max_dist: 160,
        }],
      },
      'minecraft:behavior.move_towards_target': { priority: 1, speed_multiplier: 1.4, within_radius: 160 },
    },
  },
  extraEvents: {
    'hunting:on_tame': { remove: { component_groups: ['hunting:dog_wild'] }, add: { component_groups: ['hunting:dog_tame'] } },
    'hunting:track': { add: { component_groups: ['hunting:dog_tracking'] } },
    'hunting:stop_track': { remove: { component_groups: ['hunting:dog_tracking'] } },
    'hunting:spawn_tame': { add: { component_groups: ['hunting:adult', 'hunting:dog_tame', 'hunting:active'] } },
  },

  model: {
    bones: [
      { name: 'root', pivot: [0, 0, 0] },
      { name: 'body', parent: 'root', pivot: [0, 11, 0], cubes: [{ origin: [-3, 8, -7], size: [6, 6, 14], mat: 'coat' }] },
      { name: 'neck', parent: 'body', pivot: [0, 13, -6], rotation: [-25, 0, 0], cubes: [{ origin: [-2, 11, -9], size: [4, 6, 4], mat: 'coat' }] },
      { name: 'collar', parent: 'neck', pivot: [0, 14, -7], cubes: [{ origin: [-2, 14, -9], size: [4, 1, 4], mat: 'collar', inflate: 0.3 }] },
      {
        name: 'head', parent: 'neck', pivot: [0, 17, -8],
        cubes: [
          { origin: [-2.5, 15, -12], size: [5, 5, 5], mat: 'head', marks: eyes(5, { back: 1, down: 1, color: '#2a1608' }) },
          { origin: [-1.5, 15, -16], size: [3, 3, 4], mat: 'head', marks: [{ face: 'front', x: 0, y: 0, w: 3, h: 1, color: '#2a1810' }] },
        ],
      },
      { name: 'ear_l', parent: 'head', pivot: [2.5, 20, -9.5], rotation: [0, 0, -10], cubes: [{ origin: [2.5, 16, -10], size: [1, 4, 3], mat: 'ear' }] },
      { name: 'ear_r', parent: 'head', pivot: [-2.5, 20, -9.5], rotation: [0, 0, 10], cubes: [{ origin: [-3.5, 16, -10], size: [1, 4, 3], mat: 'ear' }] },
      { name: 'tail', parent: 'body', pivot: [0, 13, 7], rotation: [-30, 0, 0], cubes: [{ origin: [-1, 13, 7], size: [2, 2, 6], mat: 'coat' }] },
      ...legs4({ x: 3, front: -6, back: 4, w: 2, h: 9, foot: 1, mat: 'coat', footMat: 'paw' }),
    ],
  },
  organs: [],

  materials: {
    coat: {
      base: '#f2eee6',
      layers: [
        spots('#7a4a2e', { size: 1.4, radius: 0.22, seed: 5 }),
        spots('#6a3a22', { size: 6, radius: 0.42, seed: 9, where: bone('body', 'tail') }),
        region('#6a3a22', all(bone('neck'), face('top', 'left', 'right', 'back'))),
        underside('#f2eee6', { y: 9, soft: 1, where: bone('body') }),
        mottle(0.05),
        fur(0.05),
      ],
    },
    head: { base: '#6a3a22', layers: [region('#f2eee6', ({ face: f, p }) => f === 'top' && Math.abs(p[0]) < 0.6), fur(0.05)] },
    ear: { base: '#5a3020', layers: [fur(0.05)] },
    paw: { base: '#e8e2d6', layers: [fur(0.05)] },
    collar: { base: '#c0392b', layers: [region('#d8b040', ({ face: f, i }) => f === 'front' && i === 1)], shading: 0.05 },
  },

  anims: {
    ...quadruped({ neck: 'neck', tail: ['tail'], ears: ['ear_l', 'ear_r'], swing: 35, sleepDrop: 5, legFold: 85, walkLength: 0.7, runLength: 0.35 }),
  },
};
