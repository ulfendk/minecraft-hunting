// Shared helpers for game animals: species data, hunting state, size, sex.
import { world } from '@minecraft/server';
import { ANIMALS, HUD } from './data.js';
import { windAt } from './lib/ballistics.js';

export const STATE = { calm: 0, alert: 1, flee: 2, wounded: 3, carcass: 4 };
export const BY_ID = new Map(ANIMALS.map((a) => [a.id, a]));

/** Species record for a game animal entity, or undefined. */
export function speciesOf(entity) {
  try {
    if (!entity.typeId.startsWith('hunting:')) return undefined;
    const a = BY_ID.get(entity.typeId.slice(8));
    return a?.game ? a : undefined;
  } catch {
    return undefined;
  }
}

export function getState(entity) {
  try {
    return entity.getProperty('hunting:state') ?? 0;
  } catch {
    return 0;
  }
}

export function setState(entity, state) {
  try {
    if (getState(entity) !== state) entity.setProperty('hunting:state', state);
  } catch {
    // Unloaded.
  }
}

export function isBaby(entity) {
  try {
    return !!entity.getComponent('minecraft:is_baby');
  } catch {
    return false;
  }
}

/** Variant 0 is the male (antlers etc.) for species that show the difference. */
export function isMale(entity) {
  try {
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

export const nameOf = (id) => ({ translate: `entity.hunting:${id}.name` });

/** Every game animal near any player (each once). */
export function gameNearPlayers(radius = 96) {
  const out = new Map();
  for (const player of world.getPlayers()) {
    try {
      for (const e of player.dimension.getEntities({ families: ['hunting_game'], location: player.location, maxDistance: radius })) out.set(e.id, e);
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

/** Called every tick: takes the x-ray away again when its time is up. */
export function tickHud(player, now) {
  const h = hud.get(player.id);
  if (h?.xray && now >= h.xrayUntil) {
    h.xray = undefined;
    refreshHud(player);
  }
}
