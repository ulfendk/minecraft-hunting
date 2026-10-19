// The mini submarine's Bedrock entity (behaviour and client). It has no AI and no input
// component: scripts/submarine.js steers it every tick from the pilot's input.
import { NS } from './constants.mjs';

const ID = 'mini_submarine';
const no = (cause) => ({ cause, deals_damage: 'no' });

export function buildSubmarine(sub) {
  return {
    format_version: '1.21.90',
    'minecraft:entity': {
      description: {
        identifier: `${NS}:${ID}`,
        is_spawnable: false,
        is_summonable: true,
        properties: {
          [`${NS}:lights`]: { type: 'bool', default: false, client_sync: true },
          // Throttle in tenths (an int: JSON can't write the 0.0 a float property's default needs).
          [`${NS}:thrust`]: { type: 'int', range: [0, 10], default: 0, client_sync: true },
        },
      },
      components: {
        'minecraft:type_family': { family: ['hunting_submarine', 'inanimate'] },
        'minecraft:collision_box': { width: sub.size[0], height: sub.size[1] },
        'minecraft:health': { value: sub.health, max: sub.health },
        'minecraft:physics': { has_gravity: false },
        'minecraft:pushable': { is_pushable: false, is_pushable_by_piston: true },
        'minecraft:knockback_resistance': { value: 1 },
        'minecraft:persistent': {},
        'minecraft:fire_immune': {},
        'minecraft:is_hidden_when_invisible': {},
        'minecraft:breathable': { breathes_air: true, breathes_water: true, suffocate_time: 0, total_supply: 15 },
        'minecraft:rideable': {
          seat_count: 1,
          crouching_skip_interact: true,
          pull_in_entities: false,
          family_types: ['player'],
          interact_text: `action.interact.${NS}.board`,
          seats: [{ position: sub.seat, min_rider_count: 0, max_rider_count: 1, third_person_camera_radius: 6 }],
        },
        // Only a player can break it, like a boat.
        'minecraft:damage_sensor': {
          triggers: [
            no('fall'), no('drowning'), no('suffocation'), no('fly_into_wall'), no('lava'), no('fire'), no('fire_tick'),
            { on_damage: { filters: { test: 'is_family', subject: 'other', operator: '!=', value: 'player' } }, deals_damage: 'no' },
          ],
        },
        'minecraft:loot': { table: `loot_tables/entities/${NS}_${ID}.json` },
        'minecraft:conditional_bandwidth_optimization': {
          default_values: { max_optimized_distance: 0, max_dropped_ticks: 0, use_motion_prediction_hints: true },
        },
      },
    },
  };
}

export function buildSubmarineLoot() {
  return { pools: [{ rolls: 1, entries: [{ type: 'item', name: `${NS}:${ID}`, weight: 1 }] }] };
}

export function buildSubmarineClient() {
  return {
    format_version: '1.10.0',
    'minecraft:client_entity': {
      description: {
        identifier: `${NS}:${ID}`,
        materials: { default: 'entity_alphablend' },
        textures: { default: `textures/entity/${NS}/${ID}` },
        geometry: { default: `geometry.${NS}.${ID}` },
        animations: { spin: `animation.${NS}.${ID}.spin` },
        scripts: { animate: [{ spin: `query.property('${NS}:thrust') > 0` }] },
        render_controllers: [`controller.render.${NS}.${ID}`],
        enable_attachables: false,
      },
    },
  };
}

export function buildSubmarineRenderController() {
  return {
    format_version: '1.8.0',
    render_controllers: {
      [`controller.render.${NS}.${ID}`]: {
        geometry: 'Geometry.default',
        materials: [{ '*': 'Material.default' }],
        textures: ['Texture.default'],
        part_visibility: [{ '*': true }, { lamp_glow: `query.property('${NS}:lights')` }],
      },
    },
  };
}
