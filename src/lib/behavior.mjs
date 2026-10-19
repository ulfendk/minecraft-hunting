// Animal spec -> Bedrock behavior-pack files (entity, spawn rules, loot table).
import { NS } from './constants.mjs';

/** Hunting states, synced to clients as the hunting:state property (see scripts/senses.js). */
export const STATE = { calm: 0, alert: 1, flee: 2, wounded: 3, carcass: 4 };

const fam = (value) => ({ test: 'is_family', subject: 'other', value });
const anyFamily = (list) => (list.length === 1 ? fam(list[0]) : { any_of: list.map(fam) });

const BIOME_TAGS = {
  savanna: 'savanna',
  jungle: 'jungle',
  desert: 'desert',
  swamp: 'swamp',
  mangrove: 'mangrove_swamp',
  river: 'river',
  beach: 'beach',
  mesa: 'mesa',
  plains: 'plains',
  forest: 'forest',
  taiga: 'taiga',
  mountains: 'mountains',
};

/** Prefix vanilla items with minecraft: and our own with the namespace. */
export const itemId = (name) => (name.includes(':') ? name : `minecraft:${name}`);

function baseComponents(a) {
  const c = {
    'minecraft:is_hidden_when_invisible': {},
    'minecraft:type_family': { family: [a.id, 'hunting', ...(a.game ? ['hunting_game'] : []), a.role, ...(a.family ?? []), 'mob'] },
    'minecraft:collision_box': { width: hitbox(a)[0], height: hitbox(a)[1] },
    'minecraft:health': { value: a.health, max: a.health },
    'minecraft:movement': { value: a.speed },
    'minecraft:jump.static': {},
    'minecraft:nameable': {},
    'minecraft:physics': {},
    'minecraft:pushable': { is_pushable: true, is_pushable_by_piston: true },
    'minecraft:leashable': {},
    'minecraft:balloonable': { mass: Math.min(2, a.size[0] * a.size[1]) },
    'minecraft:despawn': { despawn_from_distance: {} },
    'minecraft:conditional_bandwidth_optimization': {},
    'minecraft:hurt_on_condition': {
      damage_conditions: [{ filters: { test: 'in_lava', subject: 'self' }, cause: 'lava', damage_per_tick: 4 }],
    },
    'minecraft:behavior.random_look_around': { priority: 10 },
    'minecraft:behavior.look_at_player': { priority: 9, look_distance: 8, probability: 0.02 },
  };

  if (a.sounds?.ambient) {
    c['minecraft:ambient_sound_interval'] = { event_name: 'ambient', range: 16, value: a.sounds.interval ?? 10 };
  }
  if (a.fallImmune) {
    c['minecraft:damage_sensor'] = { triggers: [{ cause: 'fall', deals_damage: 'no' }] };
  }
  if (a.noDespawn) delete c['minecraft:despawn'];
  if (a.knockbackResistance) {
    c['minecraft:knockback_resistance'] = { value: a.knockbackResistance };
  }

  // Movement type
  switch (a.movement ?? 'walk') {
    case 'fly':
      // Parrot-style flight: flies around, lands on the ground and in trees.
      Object.assign(c, {
        'minecraft:movement.fly': {},
        'minecraft:flying_speed': { value: a.flySpeed ?? 0.15 },
        'minecraft:can_fly': {},
        'minecraft:navigation.fly': { can_path_from_air: true, can_path_over_water: true, avoid_damage_blocks: true },
        'minecraft:damage_sensor': { triggers: [{ cause: 'fall', deals_damage: 'no' }] },
        'minecraft:breathable': { total_supply: 15, suffocate_time: 0 },
        'minecraft:behavior.float': { priority: 0 },
        'minecraft:behavior.random_fly': { priority: 8, can_land_on_trees: true, avoid_damage_blocks: true, xz_dist: 24, y_dist: 8, y_offset: 2, speed_multiplier: 1.0 },
      });
      break;
    case 'swim':
      // Fully aquatic fish (like cod): can't leave the water, may swim in schools.
      Object.assign(c, {
        'minecraft:underwater_movement': { value: a.swimSpeed ?? 0.12 },
        'minecraft:movement.sway': { sway_amplitude: 0 },
        'minecraft:navigation.generic': { can_breach: false, can_walk: false, can_path_over_water: false, can_sink: false, can_swim: true, is_amphibious: false },
        'minecraft:physics': { has_gravity: false },
        'minecraft:breathable': { total_supply: 15, suffocate_time: 0, breathes_air: false, breathes_water: true },
        'minecraft:behavior.random_swim': { priority: 8, interval: 0, xz_dist: 16, y_dist: 4, speed_multiplier: 1.0 },
        'minecraft:behavior.swim_idle': { priority: 9 },
        'minecraft:behavior.swim_wander': { priority: 9, interval: 0.1, look_ahead: 2 },
      });
      if (a.school) {
        c['minecraft:flocking'] = {
          in_water: true, match_variants: false, use_center_of_mass: true, low_flock_limit: 4, high_flock_limit: 8,
          goal_weight: 2, loner_chance: 0.1, influence_radius: 3, breach_influence: 7, separation_weight: 1.75,
          separation_threshold: 0.95, cohesion_weight: 2, cohesion_threshold: 1.95, innner_cohesion_threshold: 1.25,
          min_height: 1.5, block_distance: 2, block_weight: 0.85,
        };
      }
      delete c['minecraft:behavior.look_at_player'];
      delete c['minecraft:behavior.random_look_around'];
      delete c['minecraft:jump.static'];
      break;
    case 'dolphin':
      // Air-breathing swimmers (like dolphins): surface to breathe, leap out of the water.
      Object.assign(c, {
        'minecraft:underwater_movement': { value: a.swimSpeed ?? 0.15 },
        'minecraft:movement.basic': {},
        'minecraft:navigation.generic': { is_amphibious: true, can_path_over_water: true, can_swim: true, can_walk: true, can_breach: false, can_jump: false },
        'minecraft:breathable': { total_supply: 240, suffocate_time: 0, breathes_air: true, breathes_water: false, generates_bubbles: false },
        'minecraft:can_climb': {},
        'minecraft:behavior.swim_up_for_breath': { priority: 1 },
        'minecraft:behavior.random_swim': { priority: 7, interval: 0, xz_dist: 20 },
        'minecraft:behavior.random_breach': { priority: 6, interval: 50, xz_dist: 6, cooldown_time: 2.0 },
        'minecraft:behavior.swim_with_entity': {
          priority: 4, success_rate: 0.1, chance_to_stop: 0.0333, state_check_interval: 0.5, catch_up_threshold: 12.0,
          match_direction_threshold: 2.0, catch_up_multiplier: 2.5, speed_multiplier: 1.5, search_range: 20.0, stop_distance: 5.0,
          entity_types: [{ filters: { test: 'is_family', subject: 'other', value: 'player' } }],
        },
        'minecraft:physics': {},
      });
      break;
    case 'climb':
      // Wall climbers (like spiders).
      Object.assign(c, {
        'minecraft:movement.basic': {},
        'minecraft:navigation.climb': { can_path_over_water: true, avoid_damage_blocks: true },
        'minecraft:can_climb': {},
        'minecraft:breathable': { total_supply: 15, suffocate_time: 0 },
        'minecraft:behavior.float': { priority: 0 },
        'minecraft:behavior.random_stroll': { priority: 8, speed_multiplier: 0.8, xz_dist: a.strollRange ?? 8 },
        'minecraft:damage_sensor': { triggers: [{ cause: 'fall', deals_damage: 'no' }] },
      });
      break;
    case 'amphibious':
      Object.assign(c, {
        'minecraft:movement.amphibious': { max_turn: 10 },
        'minecraft:navigation.generic': { is_amphibious: true, can_path_over_water: false, can_swim: true, can_walk: true, can_breach: true, can_sink: false, avoid_damage_blocks: true },
        'minecraft:underwater_movement': { value: a.swimSpeed ?? 0.15 },
        'minecraft:breathable': { total_supply: 300, suffocate_time: 0, breathes_air: true, breathes_water: true },
        'minecraft:buoyant': { base_buoyancy: 1.0, apply_gravity: true, simulate_waves: false, liquid_blocks: ['minecraft:water', 'minecraft:flowing_water'] },
        'minecraft:behavior.random_stroll': { priority: 8, speed_multiplier: 0.8 },
        'minecraft:behavior.random_swim': { priority: 8, speed_multiplier: 1.0, xz_dist: 10, y_dist: 3, interval: 80 },
        'minecraft:behavior.move_to_water': { priority: 7, search_range: 16, search_height: 5, search_count: 1, goal_radius: 0.1 },
      });
      break;
    default:
      Object.assign(c, {
        'minecraft:movement.basic': {},
        'minecraft:navigation.walk': {
          can_path_over_water: true, avoid_water: !a.wades, avoid_damage_blocks: true, can_walk_in_lava: false,
        },
        'minecraft:breathable': { total_supply: 15, suffocate_time: 0 },
        'minecraft:behavior.float': { priority: 0 },
        'minecraft:behavior.random_stroll': { priority: 8, speed_multiplier: 0.8, xz_dist: a.strollRange ?? 10 },
      });
      if (a.climbs) c['minecraft:can_climb'] = {};
      if (a.movement === 'hop') {
        // Rabbit-style hopping.
        delete c['minecraft:movement.basic'];
        delete c['minecraft:jump.static'];
        c['minecraft:movement.skip'] = {};
        c['minecraft:jump.dynamic'] = {
          regular_skip_data: { distance_scale: 1.2, height: 0.35, jump_delay: 8, animation_duration: 12 },
          fast_skip_data: { distance_scale: 2.4, height: 0.3, jump_delay: 1, animation_duration: 10 },
        };
      }
  }

  // Prey runs from the animals that hunt it.
  const avoid = [];
  if (a.fleesFrom?.length) {
    avoid.push({
      filters: anyFamily(a.fleesFrom),
      max_dist: a.fleeDistance ?? 12,
      walk_speed_multiplier: 1.3,
      sprint_speed_multiplier: a.fleeSpeed ?? 1.6,
    });
  }
  // Game animals that have been spooked or wounded (scripts/senses.js sets the state)
  // run from hunters and from the place a shot came from.
  if (a.game) {
    avoid.push({
      filters: {
        all_of: [
          { any_of: [fam('player'), fam('hunting_scare'), fam('hunting_dog')] },
          { test: 'int_property', subject: 'self', domain: `${NS}:state`, operator: '>=', value: STATE.flee },
          { test: 'int_property', subject: 'self', domain: `${NS}:state`, operator: '<=', value: STATE.wounded },
        ],
      },
      max_dist: 96,
      walk_speed_multiplier: 1.6,
      sprint_speed_multiplier: a.fleeSpeed ?? 1.8,
    });
  }
  if (avoid.length) {
    c['minecraft:behavior.avoid_mob_type'] = { priority: a.game ? 1 : 3, remove_target: true, entity_types: avoid };
  }

  // How it reacts when hurt.
  if (a.attack) {
    c['minecraft:attack'] = { damage: a.attack.damage, ...(a.attack.effect ? { effect_name: a.attack.effect, effect_duration: 4 } : {}) };
    c['minecraft:behavior.melee_box_attack'] = {
      priority: 3,
      speed_multiplier: a.attack.speed ?? 1.3,
      track_target: true,
      cooldown_time: a.attack.cooldown ?? 1.0,
    };
    c['minecraft:behavior.hurt_by_target'] = { priority: 1, alert_same_type: !!a.alertsPack, hurt_owner: false };
    if (a.attack.leap) c['minecraft:behavior.leap_at_target'] = { priority: 2, yd: 0.4, must_be_on_ground: true, target_dist: 0.4 };
  } else {
    c['minecraft:behavior.panic'] = { priority: 1, speed_multiplier: a.panicSpeed ?? 1.5 };
  }

  if (a.tempt?.length) {
    c['minecraft:behavior.tempt'] = { priority: 4, speed_multiplier: 1.1, items: a.tempt.map(itemId), can_tempt_vertically: true };
  }
  if (a.grazes) {
    c['minecraft:behavior.eat_block'] = {
      priority: 7,
      success_chance: 'query.is_baby ? 0.02 : 0.001',
      time_until_eat: 1.8,
      eat_and_replace_block_pairs: [
        { eat_block: 'minecraft:short_grass', replace_block: 'minecraft:air' },
        { eat_block: 'minecraft:grass_block', replace_block: 'minecraft:dirt' },
      ],
      on_eat: { event: `${NS}:on_eat`, target: 'self' },
    };
  }
  if (a.heal?.length) {
    c['minecraft:healable'] = { items: a.heal.map(([item, amount]) => ({ item: itemId(item), heal_amount: amount })) };
  }

  return c;
}

/** Component groups shared by every species: baby/adult and the day/night schedule. */
function lifeGroups(a) {
  const breedItems = (a.breed ?? []).map(itemId);
  const groups = {
    [`${NS}:baby`]: {
      'minecraft:is_baby': {},
      'minecraft:scale': { value: a.babyScale ?? 0.5 },
      'minecraft:ageable': {
        duration: 1200,
        feed_items: breedItems.map((item) => ({ item, growth: 0.1 })),
        grow_up: { event: `${NS}:grow_up`, target: 'self' },
      },
      'minecraft:behavior.follow_parent': { priority: 5, speed_multiplier: 1.1 },
    },
    [`${NS}:adult`]: {
      'minecraft:experience_reward': { on_bred: 'Math.Random(1,7)', on_death: `query.last_hit_by_player ? Math.Random(1,${a.xp ?? 3}) : 0` },
      'minecraft:loot': { table: `loot_tables/entities/${NS}_${a.id}.json` },
    },
  };
  if (breedItems.length && !a.ride) {
    Object.assign(groups[`${NS}:adult`], {
      'minecraft:breedable': {
        require_tame: false,
        breeds_with: { mate_type: `${NS}:${a.id}`, baby_type: `${NS}:${a.id}`, breed_event: { event: `${NS}:entity_born`, target: 'baby' } },
        breed_items: breedItems,
      },
      'minecraft:behavior.breed': { priority: 2, speed_multiplier: 1.0 },
    });
  }

  // Active hours: hunting and roaming. Resting hours: napping (shown with the sleep animation).
  const active = {};
  const resting = {};
  if (a.hunts?.length) {
    active['minecraft:behavior.nearest_attackable_target'] = {
      priority: 5,
      must_see: true,
      reselect_targets: true,
      attack_interval: a.huntInterval ?? 30,
      entity_types: [{
        filters: anyFamily(a.hunts),
        max_dist: a.huntRange ?? 16,
      }],
    };
  }
  if (a.hostile) {
    // Hostile to players (optionally only at night or near water), never in peaceful.
    const playerTarget = {
      filters: { all_of: [fam('player'), ...(a.hostile.filters ?? [])] },
      max_dist: a.hostile.range ?? 10,
    };
    const tgt = active['minecraft:behavior.nearest_attackable_target'];
    if (tgt) tgt.entity_types.push(playerTarget);
    else active['minecraft:behavior.nearest_attackable_target'] = { priority: 5, must_see: true, reselect_targets: true, entity_types: [playerTarget] };
  }

  const sleeps = a.sleeps ?? 'night';
  if (sleeps !== 'never') {
    resting['minecraft:behavior.nap'] = {
      priority: 6,
      cooldown_min: 4,
      cooldown_max: 12,
      mob_detect_dist: 10,
      mob_detect_height: 4,
      can_nap_filters: {
        all_of: [
          { test: 'in_water', subject: 'self', operator: '==', value: false },
          { test: 'on_ground', subject: 'self', operator: '==', value: true },
          { test: 'is_riding', subject: 'self', operator: '==', value: false },
          { test: 'has_target', subject: 'self', operator: '==', value: false },
        ],
      },
      wake_mob_exceptions: { any_of: [fam(a.id), { test: 'is_sneaking', subject: 'other', operator: '==', value: true }] },
    };
  }
  groups[`${NS}:active`] = active;
  groups[`${NS}:resting`] = resting;
  return groups;
}

/** Collision size after the species' size multiplier (very wide boxes path badly, so width is capped). */
export function hitbox(a) {
  const k = a.scale ?? 1;
  const r = (v) => Math.round(v * 100) / 100;
  return [r(Math.min(a.size[0] * k, Math.max(a.size[0], 2.6))), r(a.size[1] * k)];
}

/** Horse-style taming and riding (zebra, ostrich, elephant). */
function rideGroups(a) {
  const r = a.ride;
  const k = a.scale ?? 1;
  const seats = (r.seats ?? [r.seat]).map((position) => ({
    position: position.map((v) => Math.round(v * k * 100) / 100),
    min_rider_count: 0,
    max_rider_count: (r.seats ?? [r.seat]).length,
  }));
  const feed = (r.tameItems ?? a.tempt ?? []).map((item) => ({ item: itemId(item), temper_mod: 4 }));
  const breedItems = (a.breed ?? []).map(itemId);
  return {
    [`${NS}:wild`]: {
      'minecraft:rideable': {
        seat_count: 1,
        family_types: ['player'],
        interact_text: 'action.interact.mount',
        seats: { position: seats[0].position },
      },
      'minecraft:behavior.mount_pathing': { priority: 2, speed_multiplier: 1.5, target_dist: 0, track_target: true },
      'minecraft:tamemount': {
        min_temper: 0,
        max_temper: r.temper ?? 100,
        feed_text: 'action.interact.feed',
        ride_text: 'action.interact.mount',
        feed_items: feed,
        auto_reject_items: [{ item: 'minecraft:saddle' }],
        tame_event: { event: `${NS}:on_tame`, target: 'self' },
      },
    },
    [`${NS}:tamed`]: {
      'minecraft:is_tamed': {},
      'minecraft:rideable': {
        seat_count: seats.length,
        crouching_skip_interact: true,
        family_types: ['player'],
        interact_text: 'action.interact.ride.horse',
        seats,
      },
      'minecraft:interact': {
        interactions: [
          {
            on_interact: {
              filters: { all_of: [
                { test: 'has_equipment', subject: 'self', domain: 'inventory', operator: 'not', value: 'saddle' },
                { test: 'has_equipment', subject: 'other', domain: 'hand', value: 'saddle' },
                { test: 'is_sneak_held', subject: 'other', value: false },
              ] },
              target: 'self',
            },
            equip_item_slot: '0',
            interact_text: 'action.interact.saddle',
          },
          ...(r.chest ? [{
            on_interact: {
              filters: { all_of: [
                { test: 'has_component', subject: 'self', operator: '!=', value: 'minecraft:is_chested' },
                { test: 'has_equipment', subject: 'other', domain: 'hand', value: 'chest' },
                { test: 'is_sneak_held', subject: 'other', value: false },
              ] },
              event: `${NS}:on_chest`,
              target: 'self',
            },
            use_item: true,
            play_sounds: 'armor.equip_generic',
            interact_text: 'action.interact.attachchest',
          }] : []),
        ],
      },
      'minecraft:inventory': { inventory_size: 2, container_type: 'horse' },
      ...(breedItems.length ? {
        'minecraft:breedable': {
          require_tame: true,
          breeds_with: { mate_type: `${NS}:${a.id}`, baby_type: `${NS}:${a.id}`, breed_event: { event: `${NS}:entity_born`, target: 'baby' } },
          breed_items: breedItems,
        },
        'minecraft:behavior.breed': { priority: 2, speed_multiplier: 1.0 },
      } : {}),
    },
    [`${NS}:saddled`]: {
      'minecraft:is_saddled': {},
      'minecraft:input_ground_controlled': {},
      ...(r.jump === false ? {} : { 'minecraft:can_power_jump': {} }),
      'minecraft:behavior.player_ride_tamed': {},
    },
    ...(r.chest ? {
      [`${NS}:chested`]: {
        'minecraft:is_chested': {},
        'minecraft:inventory': { inventory_size: 16, container_type: 'horse' },
      },
    } : {}),
  };
}

/** Several features add damage-sensor rules; merge them into one list. */
function addDamageTrigger(components, trigger, first = false) {
  const ds = components['minecraft:damage_sensor'] ?? { triggers: [] };
  const old = Array.isArray(ds.triggers) ? ds.triggers : [ds.triggers];
  ds.triggers = first ? [trigger, ...old] : [...old, trigger];
  components['minecraft:damage_sensor'] = ds;
}

/**
 * Game animals: a synced hunting:state (calm, alert, fleeing, wounded, carcass) that the
 * scripts drive, and a carcass state. Everything the living animal does (AI, navigation,
 * day/night schedule) lives in the hunting:alive group, which the carcass loses.
 */
function gameAnimal(a, components, groups, events, properties) {
  properties[`${NS}:state`] = { type: 'int', range: [0, 4], default: 0, client_sync: true };
  const alive = {};
  for (const key of Object.keys(components)) {
    if (/^minecraft:(behavior\.|navigation\.|environment_sensor|ambient_sound_interval|healable)/.test(key)) {
      alive[key] = components[key];
      delete components[key];
    }
  }
  groups[`${NS}:alive`] = alive;
  groups[`${NS}:carcass`] = {
    'minecraft:interact': {
      interactions: [{
        on_interact: {
          filters: { test: 'has_equipment', subject: 'other', domain: 'hand', value: `${NS}:hunting_knife` },
          event: `${NS}:field_dress`,
          target: 'self',
        },
        swing: true,
        interact_text: `action.interact.${NS}.field_dress`,
      }],
    },
    'minecraft:timer': { looping: false, time: 1200, time_down_event: { event: `${NS}:rot`, target: 'self' } },
  };
  groups[`${NS}:despawn`] = { 'minecraft:instant_despawn': {} };
  // Answering a call: walk over to where it came from (a lure marker left by scripts/gear.js).
  groups[`${NS}:lured`] = {
    'minecraft:behavior.nearest_attackable_target': {
      priority: 2, must_see: false, reselect_targets: true, within_radius: 80,
      entity_types: [{ filters: fam('hunting_lure'), max_dist: 80 }],
    },
    'minecraft:behavior.move_towards_target': { priority: 2, speed_multiplier: 1.0, within_radius: 80 },
  };
  events[`${NS}:lure`] = { add: { component_groups: [`${NS}:lured`] } };
  events[`${NS}:unlure`] = { remove: { component_groups: [`${NS}:lured`] } };
  const spawned = events['minecraft:entity_spawned'].sequence;
  spawned.unshift({ add: { component_groups: [`${NS}:alive`] } });
  for (const e of [`${NS}:entity_born`, `${NS}:spawn_adult`]) events[e].add.component_groups.unshift(`${NS}:alive`);
  const lifeGroups = [`${NS}:alive`, `${NS}:active`, `${NS}:resting`, `${NS}:adult`, `${NS}:baby`, ...(a.ride ? [`${NS}:wild`, `${NS}:tamed`] : [])];
  events[`${NS}:become_carcass`] = {
    remove: { component_groups: [...lifeGroups, `${NS}:lured`] },
    add: { component_groups: [`${NS}:carcass`] },
    set_property: { [`${NS}:state`]: STATE.carcass },
  };
  // The script hears this through dataDrivenEntityTrigger, hands out the meat and trophy, and removes the carcass.
  events[`${NS}:field_dress`] = {};
  events[`${NS}:rot`] = { add: { component_groups: [`${NS}:despawn`] } };
  // A carcass can't be hurt any more and isn't pushed around.
  addDamageTrigger(components, {
    on_damage: { filters: { test: 'int_property', subject: 'self', domain: `${NS}:state`, value: STATE.carcass } },
    deals_damage: 'no',
  }, true);
}

export function buildEntity(a) {
  const components = baseComponents(a);
  const groups = { ...lifeGroups(a), ...(a.ride ? rideGroups(a) : {}), ...(a.extraGroups ?? {}) };
  const extraEvents = {};
  const properties = { ...(a.properties ?? {}) };

  if (a.poisonImmune) addDamageTrigger(components, { cause: 'magic', deals_damage: 'no' });
  if (a.ride) {
    components['minecraft:equippable'] = {
      slots: [{
        slot: 0, item: 'saddle', accepted_items: ['saddle'],
        on_equip: { event: `${NS}:saddled` }, on_unequip: { event: `${NS}:unsaddled` },
      }],
    };
    if (a.ride.jumpStrength) components['minecraft:horse.jump_strength'] = { value: a.ride.jumpStrength };
  }

  // Swap between active and resting at dawn/dusk.
  const sleeps = a.sleeps ?? 'night';
  const activeByDay = sleeps !== 'day';
  components['minecraft:environment_sensor'] = {
    triggers: [
      { filters: { test: 'is_daytime', value: activeByDay }, event: `${NS}:become_active` },
      { filters: { test: 'is_daytime', value: !activeByDay }, event: `${NS}:become_resting` },
    ],
  };

  Object.assign(components, a.extraComponents ?? {});

  const adult = [`${NS}:adult`, ...(a.ride ? [`${NS}:wild`] : [])];
  const events = {
    'minecraft:entity_spawned': {
      sequence: [
        {
          randomize: [
            { weight: 85, add: { component_groups: adult } },
            { weight: 15, add: { component_groups: [`${NS}:baby`] } },
          ],
        },
        { add: { component_groups: [`${NS}:active`] } },
        ...(a.spawnGroups ? [{ add: { component_groups: a.spawnGroups } }] : []),
        ...(a.variants ? [{ randomize: a.variants.map((v, i) => ({ weight: v.weight ?? 1, add: { component_groups: [`${NS}:variant_${i}`] } })) }] : []),
      ],
    },
    [`${NS}:entity_born`]: { add: { component_groups: [`${NS}:baby`, `${NS}:active`] } },
    [`${NS}:spawn_adult`]: { add: { component_groups: [...adult, `${NS}:active`] } },
    [`${NS}:grow_up`]: { remove: { component_groups: [`${NS}:baby`] }, add: { component_groups: adult } },
    [`${NS}:become_active`]: { remove: { component_groups: [`${NS}:resting`] }, add: { component_groups: [`${NS}:active`] } },
    [`${NS}:become_resting`]: { remove: { component_groups: [`${NS}:active`] }, add: { component_groups: [`${NS}:resting`] } },
    [`${NS}:on_eat`]: {},
  };
  if (a.ride) {
    Object.assign(events, {
      [`${NS}:on_tame`]: { remove: { component_groups: [`${NS}:wild`] }, add: { component_groups: [`${NS}:tamed`] } },
      [`${NS}:saddled`]: { add: { component_groups: [`${NS}:saddled`] } },
      [`${NS}:unsaddled`]: { remove: { component_groups: [`${NS}:saddled`] } },
      [`${NS}:spawn_tame`]: { add: { component_groups: [`${NS}:adult`, `${NS}:tamed`, `${NS}:active`] } },
    });
    if (a.ride.chest) events[`${NS}:on_chest`] = { add: { component_groups: [`${NS}:chested`] } };
  }
  if (a.variants) {
    a.variants.forEach((v, i) => {
      groups[`${NS}:variant_${i}`] = { 'minecraft:variant': { value: i } };
      events[`${NS}:make_variant_${i}`] = {
        remove: { component_groups: a.variants.map((_, j) => `${NS}:variant_${j}`).filter((_, j) => j !== i) },
        add: { component_groups: [`${NS}:variant_${i}`] },
      };
    });
  }
  if (a.game) gameAnimal(a, components, groups, events, properties);
  Object.assign(events, extraEvents, a.extraEvents ?? {});

  return {
    format_version: '1.21.90',
    'minecraft:entity': {
      description: {
        identifier: `${NS}:${a.id}`,
        spawn_category: 'creature',
        is_spawnable: true,
        is_summonable: true,
        ...(Object.keys(properties).length ? { properties } : {}),
      },
      component_groups: groups,
      components,
      events,
    },
  };
}

/** Herd spawning. Variant species spawn single-variant herds unless `herdEvent` says otherwise. */
function herd(a, s) {
  const size = { min_size: s.group?.[0] ?? 1, max_size: s.group?.[1] ?? 1 };
  if (s.herdEvent) return { ...size, event: s.herdEvent.event, event_skip_count: s.herdEvent.skip ?? 0 };
  if (a.variants && !a.variantsMixed) return a.variants.map((v, i) => ({ ...size, event: `${NS}:make_variant_${i}` }));
  return size;
}

export function buildSpawnRules(a) {
  const conditions = (a.spawn ?? []).map((s) => {
    const biomes = s.biomes.map((b) => ({ test: 'has_biome_tag', operator: '==', value: BIOME_TAGS[b] ?? b }));
    const cond = {
      'minecraft:spawns_on_surface': {},
      ...(s.blocks ? { 'minecraft:spawns_on_block_filter': s.blocks.map(itemId) } : {}),
      'minecraft:brightness_filter': { min: 7, max: 15, adjust_for_weather: false },
      'minecraft:weight': { default: s.weight ?? 5 },
      'minecraft:herd': herd(a, s),
      'minecraft:density_limit': { surface: s.density ?? 6 },
      'minecraft:biome_filter': biomes.length === 1 ? biomes[0] : { any_of: biomes },
    };
    if (s.water) {
      delete cond['minecraft:spawns_on_surface'];
      delete cond['minecraft:brightness_filter'];
      cond['minecraft:spawns_underwater'] = {};
      cond['minecraft:height_filter'] = { min: 40, max: 70 };
    }
    return cond;
  });
  return {
    format_version: '1.8.0',
    'minecraft:spawn_rules': {
      description: { identifier: `${NS}:${a.id}`, population_control: (a.spawn ?? []).length && a.spawn.every((s) => s.water) ? 'water_animal' : 'animal' },
      conditions,
    },
  };
}

export function buildLoot(a) {
  const pools = (a.loot ?? []).map((l) => {
    const functions = [{ function: 'set_count', count: { min: l.min ?? 0, max: l.max ?? 1 } }];
    if (l.smelts) functions.push({ function: 'furnace_smelt', conditions: [{ condition: 'entity_properties', entity: 'this', properties: { on_fire: true } }] });
    functions.push({ function: 'looting_enchant', count: { min: 0, max: 1 } });
    return {
      rolls: 1,
      ...(l.chance ? { conditions: [{ condition: 'random_chance_with_looting', chance: l.chance, looting_multiplier: 0.05 }] } : {}),
      entries: [{ type: 'item', name: itemId(l.item), weight: 1, functions }],
    };
  });
  return { pools };
}
