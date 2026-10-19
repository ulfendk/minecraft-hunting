// How game animals notice hunters: sight, hearing and smell build up an awareness level.
// At ALERT the animal freezes and stares; at FLEE it bolts, and the rest of the herd goes
// with it. dk.ulfen.hunting.hunt.Senses is the Java twin (same numbers).
import { system, world } from '@minecraft/server';
import { gameNearPlayers, getState, setState, speciesOf, STATE, wind } from './game.js';
import { dist, dot, norm, sub } from './util.js';

export const ALERT = 30;
export const FLEE = 75;
const STEP = 10; // ticks between checks

const awareness = new Map(); // entity id -> { level, until (flee end tick), source }
const noise = new Map(); // player id -> { radius, until }
const scentUntil = new Map(); // player id -> tick

export function awarenessOf(entity) {
  return awareness.get(entity.id)?.level ?? 0;
}

/** A loud event (a gunshot, a block breaking) heard by everything within `radius`. */
export function makeNoise(player, radius, ticks = 20) {
  const now = system.currentTick;
  const n = noise.get(player.id);
  if (!n || n.until < now || n.radius < radius) noise.set(player.id, { radius, until: now + ticks });
}

export function applyScentEliminator(player, seconds = 300) {
  scentUntil.set(player.id, system.currentTick + seconds * 20);
  try { player.setDynamicProperty('hunting:scent_until', world.getAbsoluteTime() + seconds * 20); } catch {}
}

function scentFactor(player, now) {
  let until = scentUntil.get(player.id);
  if (until === undefined) {
    try {
      const abs = player.getDynamicProperty('hunting:scent_until');
      until = typeof abs === 'number' ? now + Math.max(0, abs - world.getAbsoluteTime()) : 0;
    } catch { until = 0; }
    scentUntil.set(player.id, until);
  }
  if (until && now >= until) {
    scentUntil.set(player.id, 0);
    if (until > 0) player.sendMessage({ translate: 'hunting.scent.worn_off' });
    return 1;
  }
  return until > now ? 0.25 : 1;
}

/** 0..1 multiplier on how visible a player is: ghillie suit, hides and tree stands. */
export function concealment(player) {
  let k = 1;
  try {
    const eq = player.getComponent('minecraft:equippable');
    let pieces = 0;
    for (const slot of ['Head', 'Chest', 'Legs', 'Feet']) {
      if (eq?.getEquipment(slot)?.typeId?.startsWith('hunting:ghillie_')) pieces++;
    }
    k *= 1 - 0.14 * pieces;
  } catch {}
  if (inHide(player)) k *= 0.25;
  if (onTreeStand(player)) k *= 0.35;
  return k;
}

/** Inside a hide: at least three camouflage nets within two blocks. */
export function inHide(player) {
  const { x, y, z } = player.location;
  let nets = 0;
  try {
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 1; dy++) {
      if (player.dimension.getBlock({ x: Math.floor(x) + dx, y: Math.floor(y) + dy, z: Math.floor(z) + dz })?.typeId === 'hunting:camo_netting') nets++;
      if (nets >= 3) return true;
    }
  } catch {}
  return false;
}

/** On a tree stand at least three blocks above the ground. */
export function onTreeStand(player) {
  try {
    const { x, y, z } = player.location;
    const below = player.dimension.getBlock({ x: Math.floor(x), y: Math.floor(y - 0.1), z: Math.floor(z) });
    if (below?.typeId !== 'hunting:tree_stand') return false;
    for (let d = 2; d <= 4; d++) {
      const b = player.dimension.getBlock({ x: Math.floor(x), y: Math.floor(y) - d, z: Math.floor(z) });
      if (b && !b.isAir) return d >= 4;
    }
    return true;
  } catch {
    return false;
  }
}

function movement(player) {
  const v = player.getVelocity();
  const speed = Math.hypot(v.x, v.z);
  if (player.isSprinting) return { sight: 1.6, noise: 28 };
  if (speed > 0.03) return player.isSneaking ? { sight: 0.45, noise: 3 } : { sight: 1.0, noise: 12 };
  return player.isSneaking ? { sight: 0.2, noise: 0 } : { sight: 0.35, noise: 0 };
}

function lineOfSight(animal, eye, player) {
  try {
    const target = player.getHeadLocation();
    const d = sub(target, eye);
    const len = Math.hypot(d.x, d.y, d.z);
    const hit = animal.dimension.getBlockFromRay(eye, norm(d), { maxDistance: len, includeLiquidBlocks: false, includePassableBlocks: false });
    if (!hit) return 1;
    // Leaves only partly hide you.
    return hit.block.typeId.includes('leaves') ? 0.35 : 0;
  } catch {
    return 0;
  }
}

/** Awareness gained this step from one player. */
function sense(animal, a, player, w, now) {
  const s = a.senses;
  const head = animal.getHeadLocation();
  const p = player.location;
  const d = dist(head, p);
  if (d > 140) return 0;
  const move = movement(player);
  const hidden = concealment(player);
  let gain = 0;

  // Sight: a cone in front, plus anything very close; worse at night.
  const sightRange = 72 * s.sight;
  if (d < sightRange) {
    const view = animal.getViewDirection();
    const to = norm(sub(p, head));
    const inCone = dot(view, to) > -0.25 || d < 6;
    if (inCone) {
      const los = lineOfSight(animal, head, player);
      if (los > 0) {
        const time = world.getTimeOfDay();
        const light = time > 13000 && time < 23000 ? 0.45 : 1;
        gain += 45 * s.sight * move.sight * hidden * los * light * (1 - d / sightRange) ** 2;
      }
    }
  }

  // Hearing: footsteps, sprinting, shots, breaking blocks.
  const n = noise.get(player.id);
  const loud = Math.max(move.noise + (player.isJumping ? 8 : 0), n && n.until >= now ? n.radius : 0);
  const hearRange = loud * s.hearing;
  if (hearRange > 0 && d < hearRange) gain += 35 * s.hearing * (1 - d / hearRange);

  // Smell: carried downwind.
  const scent = scentFactor(player, now) * (onTreeStand(player) ? 0.4 : 1);
  const toAnimal = norm({ x: head.x - p.x, y: 0, z: head.z - p.z });
  const wn = w.speed > 0.5 ? (toAnimal.x * w.x + toAnimal.z * w.z) / w.speed : 0.6;
  const smellRange = (10 + 5 * w.speed) * s.smell * scent;
  if (wn > 0.5 && d < smellRange) gain += 60 * s.smell * wn * (1 - d / smellRange);

  return gain;
}

function warn(animal, a) {
  try {
    if (a.sounds?.warn) animal.dimension.playSound(a.sounds.warn, animal.location, { pitch: (a.sounds.pitch?.[0] ?? 1) * 0.8, volume: 1.2 });
    animal.playAnimation(`animation.hunting.${a.id}.stamp`, { blendOutTime: 0.2 });
  } catch {}
}

/** Make an animal bolt (and its herd with it). */
export function spook(animal, a, now, cascade = true) {
  const st = getState(animal);
  if (st === STATE.carcass) return;
  const rec = awareness.get(animal.id) ?? { level: 0 };
  rec.level = Math.max(rec.level, FLEE + 5);
  rec.until = now + (a.senses.alertTime ?? 10) * 30;
  awareness.set(animal.id, rec);
  if (st !== STATE.wounded) setState(animal, STATE.flee);
  try { animal.removeEffect('slowness'); } catch {}
  if (!cascade) return;
  try {
    for (const other of animal.dimension.getEntities({ type: animal.typeId, location: animal.location, maxDistance: a.senses.herd ?? 16 })) {
      if (other.id !== animal.id && getState(other) < STATE.flee) spook(other, a, now, false);
    }
  } catch {}
}

/** A gunshot: everything within earshot is startled; close animals bolt. A scare marker shows them where it came from. */
export function gunshot(player, loudness = 1) {
  const now = system.currentTick;
  makeNoise(player, 120 * loudness, 30);
  try {
    player.dimension.spawnEntity('hunting:scare_marker', player.location);
  } catch {}
  try {
    for (const e of player.dimension.getEntities({ families: ['hunting_game'], location: player.location, maxDistance: 140 * loudness })) {
      const a = speciesOf(e);
      if (!a || getState(e) === STATE.carcass) continue;
      const d = dist(e.location, player.location);
      const rec = awareness.get(e.id) ?? { level: 0 };
      rec.level += 30 + 70 * Math.max(0, 1 - d / (120 * loudness));
      awareness.set(e.id, rec);
      if (rec.level >= FLEE) spook(e, a, now);
    }
  } catch {}
}

function step() {
  const now = system.currentTick;
  const w = wind();
  const players = world.getPlayers();
  for (const animal of gameNearPlayers(140)) {
    const a = speciesOf(animal);
    if (!a) continue;
    const st = getState(animal);
    if (st === STATE.carcass) {
      awareness.delete(animal.id);
      continue;
    }
    const rec = awareness.get(animal.id) ?? { level: 0 };
    let gain = 0;
    for (const player of players) {
      if (player.dimension.id !== animal.dimension.id) continue;
      try {
        if (String(player.getGameMode()).toLowerCase() === 'spectator') continue;
      } catch {}
      gain = Math.max(gain, sense(animal, a, player, w, now));
    }
    rec.level = Math.max(0, Math.min(120, rec.level + gain - (gain > 0 ? 0 : 6)));
    awareness.set(animal.id, rec);

    if (st === STATE.wounded) continue; // the wound logic decides
    if (st === STATE.flee) {
      if (now >= (rec.until ?? 0)) {
        rec.level = 20;
        setState(animal, STATE.calm);
      }
      continue;
    }
    if (rec.level >= FLEE) {
      spook(animal, a, now);
    } else if (rec.level >= ALERT) {
      if (st !== STATE.alert) {
        setState(animal, STATE.alert);
        warn(animal, a);
      }
      // Freeze and stare.
      try { animal.addEffect('slowness', STEP + 4, { amplifier: 8, showParticles: false }); } catch {}
    } else if (st === STATE.alert && rec.level < ALERT / 2) {
      setState(animal, STATE.calm);
    }
  }
}

export function setupSenses() {
  system.runInterval(step, STEP);
  world.afterEvents.playerBreakBlock.subscribe(({ player }) => makeNoise(player, 16));
  world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => awareness.delete(removedEntityId));
}

/** For the self-test: the awareness one step of `sense` would add. */
export const _sense = sense;
