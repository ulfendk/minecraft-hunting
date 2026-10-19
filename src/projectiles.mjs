// Non-animal entities: the bow's arrow and invisible helpers.
import { NS } from './lib/constants.mjs';
import { weaponProjectiles } from './weapons.mjs';

export const projectiles = [...weaponProjectiles];

export function buildProjectile(p) {
  return {
    format_version: '1.21.90',
    'minecraft:entity': {
      description: { identifier: `${NS}:${p.id}`, is_spawnable: false, is_summonable: true },
      components: {
        'minecraft:collision_box': { width: 0.25, height: 0.25 },
        'minecraft:projectile': {
          on_hit: {
            impact_damage: { damage: p.damage, knockback: true },
            ...(p.effect ? { mob_effect: { effect: p.effect.effect, durationeasy: p.effect.ticks, durationnormal: p.effect.ticks, durationhard: p.effect.ticks, amplifier: p.effect.amplifier } } : {}),
            remove_on_hit: {},
          },
          power: p.power ?? 1.0,
          gravity: p.gravity ?? 0.04,
          ...(p.hitSound ? { hit_sound: p.hitSound } : {}),
          uncertainty_base: 4,
          uncertainty_multiplier: 0,
          anchor: 1,
          offset: [0, -0.1, 0],
        },
        'minecraft:physics': {},
        'minecraft:pushable': { is_pushable: false, is_pushable_by_piston: true },
        'minecraft:despawn': { despawn_from_distance: { min_distance: 32, max_distance: 64 } },
      },
    },
  };
}

export function buildProjectileClient(p) {
  return {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: `${NS}:${p.id}`,
        materials: { default: 'entity_alphatest' },
        textures: { default: `textures/entity/${NS}/${p.id}` },
        geometry: { default: `geometry.hunting.${p.id}` },
        // Point along the direction of flight, like an arrow.
        ...(p.rotate ? { animations: { move: 'animation.hunting.projectile.move' }, scripts: { animate: ['move'] } } : {}),
        render_controllers: [`controller.render.hunting.${p.id}`],
      },
    },
  };
}

/**
 * Invisible helper entities. A scare marker is left where a shot was fired; spooked animals
 * run away from it for a few seconds. A lure marker is left where a game call was blown;
 * animals that answer the call walk to it.
 */
export const helpers = [
  { id: 'scare_marker', name: 'Scare Marker', family: 'hunting_scare', lifetime: 8 },
  { id: 'lure_marker', name: 'Lure Marker', family: 'hunting_lure', lifetime: 25 },
];

export function buildHelper(h) {
  return {
    format_version: '1.21.90',
    'minecraft:entity': {
      description: { identifier: `${NS}:${h.id}`, is_spawnable: false, is_summonable: true },
      component_groups: { 'hunting:expired': { 'minecraft:instant_despawn': {} } },
      events: { 'hunting:expire': { add: { component_groups: ['hunting:expired'] } } },
      components: {
        'minecraft:type_family': { family: ['hunting_marker', 'inanimate'] },
        'minecraft:collision_box': { width: 0.1, height: 0.1 },
        'minecraft:physics': { has_gravity: false, has_collision: false },
        'minecraft:pushable': { is_pushable: false, is_pushable_by_piston: false },
        'minecraft:damage_sensor': { triggers: [{ cause: 'all', deals_damage: 'no' }] },
        'minecraft:knockback_resistance': { value: 1 },
        'minecraft:health': { value: 1, max: 1 },
        'minecraft:breathable': { breathes_water: true, breathes_air: true },
      },
    },
  };
}

export function buildHelperClient(h) {
  return {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: `${NS}:${h.id}`,
        materials: { default: 'entity_alphatest' },
        textures: { default: `textures/entity/${NS}/${h.id}` },
        geometry: { default: `geometry.hunting.${h.id}` },
        render_controllers: [`controller.render.hunting.${h.id}`],
      },
    },
  };
}
