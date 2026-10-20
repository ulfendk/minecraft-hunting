// Shared helpers for game animals: species data, hunting state, size, sex.
import { world } from '@minecraft/server';
import { ANIMALS, GAME, HUD, ZONE_PRIORITY } from './data.js';
import { windAt } from './lib/ballistics.js';

export const STATE = { calm: 0, alert: 1, flee: 2, wounded: 3, carcass: 4 };
export const BY_ID = new Map(ANIMALS.map((a) => [a.id, a]));

/**
 * Everything that can be hunted, by entity type: our own game species and the creatures
 * other add-ons register (scripts/targets.js). Records from other add-ons have the full
 * type id as `id`, a lang key as `name`, and say which entity property holds the hunting
 * state and which events make a carcass or lure the animal.
 */
export const TARGETS = new Map();
const OWN_EVENTS = { carcass: 'hunting:become_carcass', lure: 'hunting:lure', unlure: 'hunting:unlure' };
for (const a of ANIMALS) {
  if (a.game) TARGETS.set(`hunting:${a.id}`, { ...a, name: `entity.hunting:${a.id}.name`, state: 'hunting:state', events: OWN_EVENTS, sex: 'variant0' });
}

/** Adds another add-on's creature (a checked profile, see lib/protocol.js). Our own species can't be replaced. */
export function addTarget(profile) {
  if (profile.id.startsWith('hunting:')) return false;
  TARGETS.set(profile.id, {
    ...profile,
    foreign: true,
    state: profile.bedrock?.state,
    events: profile.bedrock?.events ?? {},
    sounds: profile.sounds ?? {},
  });
  return true;
}

/** Species record for a game animal entity, or undefined. */
export function speciesOf(entity) {
  try {
    return TARGETS.get(entity.typeId);
  } catch {
    return undefined;
  }
}

/** A species record by the id stored in shot and trophy records (our own species without namespace). */
export const speciesById = (id) => (id?.includes(':') ? TARGETS.get(id) : BY_ID.get(id));

export function getState(entity) {
  try {
    const a = TARGETS.get(entity.typeId);
    if (a && !a.state) return 0;
    return entity.getProperty(a?.state ?? 'hunting:state') ?? 0;
  } catch {
    return 0;
  }
}

export function setState(entity, state) {
  try {
    const a = TARGETS.get(entity.typeId);
    if (getState(entity) !== state) entity.setProperty(a?.state ?? 'hunting:state', state);
    // Our dog's tracking AI finds other add-ons' wounded and downed animals by this tag.
    if (a?.foreign) {
      if (state >= STATE.wounded) entity.addTag('hunting_quarry');
      else entity.removeTag('hunting_quarry');
    }
  } catch {
    // Unloaded.
  }
}

/** Fire one of a species' events (carcass, lure, unlure). */
export function trigger(entity, a, event) {
  const id = a?.events?.[event];
  if (!id) return;
  try {
    entity.triggerEvent(id);
  } catch {}
}

/** Game animals of any add-on near a location (each once). */
export function gameEntities(dimension, options) {
  const out = dimension.getEntities({ ...options, families: ['hunting_game'] });
  if (TARGETS.size > BY_ID.size) {
    for (const e of dimension.getEntities({ ...options, families: ['hunting_target'] })) if (TARGETS.has(e.typeId)) out.push(e);
  }
  return out;
}

/** The nearest game animal along a player's view. */
export function gameInView(player, maxDistance) {
  const hits = [...player.getEntitiesFromViewDirection({ maxDistance, families: ['hunting_game'] })];
  if (TARGETS.size > BY_ID.size) hits.push(...player.getEntitiesFromViewDirection({ maxDistance, families: ['hunting_target'] }).filter((h) => TARGETS.has(h.entity.typeId)));
  return hits.sort((p, q) => p.distance - q.distance)[0];
}

export function isBaby(entity) {
  try {
    return !!entity.getComponent('minecraft:is_baby');
  } catch {
    return false;
  }
}

/**
 * Variant 0 is the male (antlers etc.) for species that show the difference. Other
 * add-ons' variants are often colours: those animals get a sex rolled once.
 */
export function isMale(entity) {
  try {
    if (TARGETS.get(entity.typeId)?.sex === 'random') {
      let male = entity.getDynamicProperty('hunting:male');
      if (typeof male !== 'boolean') {
        male = Math.random() < 0.5;
        entity.setDynamicProperty('hunting:male', male);
      }
      return male;
    }
    return (entity.getComponent('minecraft:variant')?.value ?? 0) === 0;
  } catch {
    return true;
  }
}

/** The hit model to test shots against: females and young lack the male-only parts. */
export function hitModelOf(entity, a) {
  return a.hitModelFemale && (!isMale(entity) || isBaby(entity)) ? a.hitModelFemale : a.hitModel;
}

/** Render scale: the species' scale times the baby scale. */
export function scaleOf(entity, a) {
  let k = a.scale ?? 1;
  try {
    k *= entity.getComponent('minecraft:scale')?.value ?? 1;
  } catch {}
  return k;
}

/** A per-animal size between 0 and 1, rolled the first time it matters. */
export function sizeOf(entity) {
  try {
    let s = entity.getDynamicProperty('hunting:size');
    if (typeof s !== 'number') {
      s = Math.random() * Math.random() < 0.15 ? 0.85 + Math.random() * 0.15 : Math.random() * 0.85;
      entity.setDynamicProperty('hunting:size', s);
    }
    return s;
  } catch {
    return 0.5;
  }
}

export function weightOf(entity, a) {
  const [lo, hi] = a.game.weight;
  const kg = lo + (hi - lo) * sizeOf(entity);
  return Math.round(kg * (isBaby(entity) ? 0.3 : 1) * 10) / 10;
}

export const wind = () => windAt(world.getAbsoluteTime());

/** A species' name; `id` as stored in records (other add-ons' species with namespace). */
export const nameOf = (id) => ({ translate: TARGETS.get(id)?.name ?? (id?.includes(':') ? `entity.${id}.name` : `entity.hunting:${id}.name`) });

/** Portrait for the journal and reports: ours, or the one the other add-on names. */
export const iconOf = (id) => (id?.includes(':') ? TARGETS.get(id)?.icon : `textures/ui/hunting/${id}`);

/** X-ray picture of a species (with the zone hit): ours only, other add-ons' get their portrait. */
export const xrayOf = (id, zone) => (id?.includes(':') ? TARGETS.get(id)?.icon : `textures/ui/hunting/xray/${id}${zone ? `_${zone}` : ''}`);

/** Every game animal near any player (each once). */
export function gameNearPlayers(radius = 96) {
  const out = new Map();
  for (const player of world.getPlayers()) {
    try {
      for (const e of gameEntities(player.dimension, { location: player.location, maxDistance: radius })) out.set(e.id, e);
    } catch {}
  }
  return [...out.values()];
}

// ---------------------------------------------------------------- HUD overlays

const hud = new Map(); // player id -> { scope: code, xray: code, xrayUntil: tick }
const ch = (i) => `§${HUD.chars[i]}`;
export const scopeCode = (firearmIndex, zoom) => `${HUD.scope}${ch(firearmIndex)}${ch(zoom)}`;
export const xrayCode = (speciesIndex, zoneIndex) => `${HUD.xray}${ch(speciesIndex)}${ch(zoneIndex)}`;

function refreshHud(player) {
  const h = hud.get(player.id) ?? {};
  const text = `${h.scope ?? ''}${h.xray ?? ''}`;
  try {
    if (!text) player.onScreenDisplay.clearTitle();
    else player.onScreenDisplay.setTitle(text, { fadeInDuration: 0, stayDuration: 72000, fadeOutDuration: 0 });
  } catch {}
}

export function setScopeHud(player, code) {
  const h = hud.get(player.id) ?? {};
  if (h.scope === code) return;
  h.scope = code;
  hud.set(player.id, h);
  refreshHud(player);
}

export function flashXray(player, code, now, ticks = 100) {
  const h = hud.get(player.id) ?? {};
  h.xray = code;
  h.xrayUntil = now + ticks;
  hud.set(player.id, h);
  refreshHud(player);
}

/**
 * Flash the x-ray of one of our species: highlighting `zone` when it has a picture, else the
 * whole animal. Returns false for species without an x-ray (other add-ons' creatures).
 */
export function showXray(player, id, zone, now, ticks = 100) {
  const si = GAME.indexOf(id);
  if (si < 0) return false;
  const zi = BY_ID.get(id)?.xrayZones?.includes(zone) ? ZONE_PRIORITY.indexOf(zone) : ZONE_PRIORITY.length;
  flashXray(player, xrayCode(si, zi), now, ticks);
  return true;
}

/** Called every tick: takes the x-ray away again when its time is up. */
export function tickHud(player, now) {
  const h = hud.get(player.id);
  if (h?.xray && now >= h.xrayUntil) {
    h.xray = undefined;
    refreshHud(player);
  }
}
