// Spearfishing: the hand harpoon, the speargun, and the line that holds a speared fish.
//
// Hand harpoon: hold use and let go to throw it. It sticks where it lands; swim over it to
// pick it up again. Speargun: hold use to pull back the bands (a harpoon bolt is loaded),
// then use again to fire. Both are made for water: through the air they are slow and weak.
// A speared fish is on the line: hold sneak to reel it in, use the speargun or harpoon to let
// go. A big fish fights; keep the line tight for too long and it snaps.
import { ItemStack, system, world } from '@minecraft/server';
import { HARPOONS, LINE } from './data.js';
import { getState, nameOf, speciesOf, STATE, weightOf } from './game.js';
import { makeNoise } from './senses.js';
import { add, consumeOne, dist, eyeInWater, findItem, heldItem, isCreative, len, norm, scale, sub } from './util.js';

/** Dynamic properties on our projectiles. */
export const POWER = 'hunting:power'; // 1 under water, less through the air (scales penetration)
const DAMAGE = 'hunting:item_damage'; // a thrown harpoon's wear, so the picked-up item keeps it
const WINCH = 'hunting:winch'; // fired by a submarine's launcher: its winch reels the line in
const CREATIVE = 'hunting:creative'; // fired in creative: nothing comes back (nothing was used up)

const using = new Map(); // player id -> { kind: 'throw' | 'load', since }
const lines = new Map(); // target entity id -> line (see attach)

const isPlayer = (e) => e?.typeId === 'minecraft:player';

// ---------------------------------------------------------------- launching

/** Fire a harpoon projectile from `from` along `dir`. Under water it keeps its speed. */
export function launch(dimension, type, from, dir, speed, owner, { power = 1, damage = undefined, winch = false } = {}) {
  const p = dimension.spawnEntity(type, from);
  const proj = p.getComponent('minecraft:projectile');
  if (owner) proj.owner = owner;
  if (owner && isPlayer(owner) && isCreative(owner)) p.setDynamicProperty(CREATIVE, true);
  proj.shoot(scale(dir, speed));
  p.setDynamicProperty(POWER, power);
  if (damage !== undefined) p.setDynamicProperty(DAMAGE, damage);
  if (winch) p.setDynamicProperty(WINCH, true);
  return p;
}

function throwHarpoon(player, held, ticks) {
  const h = HARPOONS.harpoon;
  if (ticks < h.minDraw) return;
  const wet = eyeInWater(player);
  const draw = Math.min(1, ticks / 20);
  const dir = player.getViewDirection();
  const eye = player.getHeadLocation();
  const durability = held.getComponent('minecraft:durability');
  launch(player.dimension, `hunting:${h.projectile}`, add(eye, scale(dir, 0.6)), dir, h.speed * draw * (wet ? 1 : 0.8), player, {
    power: (wet ? h.powerWater : h.powerAir) * (0.5 + 0.5 * draw),
    damage: (durability?.damage ?? 0) + (isCreative(player) ? 0 : 1),
  });
  if (!isCreative(player)) player.getComponent('minecraft:inventory').container.setItem(player.selectedSlotIndex, undefined);
  player.dimension.playSound('item.trident.throw', eye);
  if (!wet) player.onScreenDisplay.setActionBar({ translate: 'hunting.hud.harpoon_weak' });
  makeNoise(player, 4);
}

/** Swap the speargun in the selected slot for the loaded (or empty) one, keeping its wear. */
function swapSpeargun(player, toType, extraWear = 0) {
  const container = player.getComponent('minecraft:inventory').container;
  const old = container.getItem(player.selectedSlotIndex);
  const next = new ItemStack(toType, 1);
  const from = old?.getComponent('minecraft:durability');
  const to = next.getComponent('minecraft:durability');
  if (from && to) {
    const damage = from.damage + (isCreative(player) ? 0 : extraWear);
    if (damage >= to.maxDurability) {
      container.setItem(player.selectedSlotIndex, undefined);
      player.playSound('random.break');
      return;
    }
    to.damage = damage;
  }
  if (old?.nameTag) next.nameTag = old.nameTag;
  container.setItem(player.selectedSlotIndex, next);
}

function loadSpeargun(player) {
  const s = HARPOONS.speargun;
  if (!isCreative(player)) {
    const bolt = findItem(player, `hunting:${s.ammo}`);
    if (!bolt) return;
    consumeOne(bolt);
  }
  swapSpeargun(player, 'hunting:speargun_loaded');
  player.playSound('crossbow.loading.end');
  player.onScreenDisplay.setActionBar({ translate: 'hunting.hud.speargun_loaded' });
}

function fireSpeargun(player) {
  const s = HARPOONS.speargun;
  const wet = eyeInWater(player);
  const dir = player.getViewDirection();
  const eye = player.getHeadLocation();
  launch(player.dimension, `hunting:${s.projectile}`, add(eye, scale(dir, 0.6)), dir, s.speed * (wet ? 1 : 0.6), player, {
    power: wet ? s.powerWater : s.powerAir,
  });
  swapSpeargun(player, 'hunting:speargun', 1);
  player.dimension.playSound('crossbow.shoot', eye, { pitch: 0.8 });
  if (!wet) player.onScreenDisplay.setActionBar({ translate: 'hunting.hud.harpoon_weak' });
  makeNoise(player, 4);
}

// ---------------------------------------------------------------- the line

/** The line a player is holding, if any. */
export function lineOf(player) {
  for (const l of lines.values()) if (l.playerId === player.id) return l;
  return undefined;
}

/** What comes back when the line is landed or let go: the thrown harpoon, or the bolt. */
function returnItem(type, damage) {
  if (type === 'hunting:thrown_harpoon') {
    const item = new ItemStack('hunting:harpoon', 1);
    const d = item.getComponent('minecraft:durability');
    if (d && damage) {
      if (damage >= d.maxDurability) return undefined; // worn out
      d.damage = damage;
    }
    return item;
  }
  return new ItemStack('hunting:harpoon_bolt', 1);
}

function give(player, item, at) {
  if (!item) return;
  try {
    const left = player.getComponent('minecraft:inventory').container.addItem(item);
    if (left) player.dimension.spawnItem(left, player.location);
  } catch {
    try { player.dimension.spawnItem(item, at); } catch {}
  }
}

/** A leash that breaks drops a lead: the line isn't a lead, so clear those away. */
function clearLeads(dimension, locations) {
  system.runTimeout(() => {
    for (const location of locations) {
      try {
        for (const e of dimension.getEntities({ type: 'minecraft:item', location, maxDistance: 4 })) {
          if (e.getComponent('minecraft:item')?.itemStack?.typeId === 'minecraft:lead') e.remove();
        }
      } catch {}
    }
  }, 1);
}

/** End a line. `how`: landed (item back), released (item back), snapped (item lost or dropped). */
function endLine(line, how) {
  lines.delete(line.targetId);
  const { target, player } = line;
  const where = [];
  try {
    if (target.isValid) {
      where.push(target.location);
      target.getComponent('minecraft:leashable')?.unleash();
    }
  } catch {}
  try { if (player?.isValid) where.push(player.location); } catch {}
  if (where.length) clearLeads(line.dimension, where);
  const item = line.creative ? undefined : returnItem(line.type, line.damage);
  if (how === 'snapped') {
    // The harpoon stays in the fish if it got away, else it drops where the line broke.
    if (item && line.type === 'hunting:thrown_harpoon' && where[0]) try { line.dimension.spawnItem(item, where[0]); } catch {}
    try { player?.onScreenDisplay.setActionBar({ translate: 'hunting.line.snapped' }); player?.playSound('random.break', { pitch: 1.4 }); } catch {}
    return;
  }
  if (player?.isValid) {
    give(player, item, where[0] ?? player.location);
    const a = target.isValid ? speciesOf(target) : undefined;
    if (how === 'landed') player.onScreenDisplay.setActionBar({ translate: 'hunting.line.landed', with: { rawtext: [a ? nameOf(a.id) : { text: '' }] } });
    else player.onScreenDisplay.setActionBar({ translate: 'hunting.line.released' });
  }
}

/**
 * Called from shooting.js when one of our harpoons hits something. The harpoon stays in the
 * animal, which is now on the line (if it can be held on one).
 */
export function harpoonStruck(projectile, target, player, report) {
  let type, damage, winch, creative;
  try {
    type = projectile.typeId;
    damage = projectile.getDynamicProperty(DAMAGE);
    winch = !!projectile.getDynamicProperty(WINCH);
    creative = !!projectile.getDynamicProperty(CREATIVE);
  } catch {
    return;
  }
  // Only game animals go on the line (like on Java).
  const leash = speciesOf(target) ? target.getComponent('minecraft:leashable') : undefined;
  const dimension = target.dimension;
  try { projectile.remove(); } catch {}
  if (!leash || !isPlayer(player) || lines.has(target.id)) {
    // Nothing to hold on to: a thrown harpoon falls out.
    if (type === 'hunting:thrown_harpoon' && !creative) {
      const item = returnItem(type, damage);
      if (item) try { dimension.spawnItem(item, target.location); } catch {}
    }
    return;
  }
  const old = lineOf(player);
  if (old) endLine(old, 'released');
  try {
    leash.leashTo(player);
  } catch {
    const item = returnItem(type, damage);
    if (item) try { dimension.spawnItem(item, target.location); } catch {}
    return;
  }
  const length = winch ? HARPOONS.speargun.line * 1.2 : type === 'hunting:thrown_harpoon' ? HARPOONS.harpoon.line : HARPOONS.speargun.line;
  lines.set(target.id, {
    targetId: target.id, target, playerId: player.id, player, dimension, type, damage, winch, winchOn: false, creative,
    length, taut: 0, since: system.currentTick, fightAt: 0,
  });
  const a = speciesOf(target);
  if (a && getState(target) !== STATE.carcass && report?.fate !== 'kill') {
    player.onScreenDisplay.setActionBar({ translate: 'hunting.line.hooked', with: { rawtext: [nameOf(a.id)] } });
  }
  player.playSound('random.bowhit', { pitch: 0.7 });
}

/** The submarine switches its winch on and off (it has to have battery to spare). */
export function setWinch(player, on) {
  const l = lineOf(player);
  if (l?.winch) l.winchOn = on;
  return l;
}

const tension = (d, length) => (d > length ? 'breaking' : d > length * 0.8 ? 'tight' : 'slack');

function tickLines(now) {
  for (const line of [...lines.values()]) {
    const { target, player } = line;
    if (!player?.isValid) {
      // The player left: the line goes slack and falls away (no lead left behind).
      lines.delete(line.targetId);
      try {
        if (target.isValid) {
          target.getComponent('minecraft:leashable')?.unleash();
          clearLeads(line.dimension, [target.location]);
        }
      } catch {}
      continue;
    }
    // Out of the submarine its winch line becomes a hand line.
    if (line.winch && player.getComponent('minecraft:riding')?.entityRidingOn?.typeId !== 'hunting:mini_submarine') {
      line.winch = false;
      line.winchOn = false;
    }
    if (!target?.isValid) {
      endLine(line, 'released');
      continue;
    }
    let leashed = true;
    try { leashed = target.getComponent('minecraft:leashable')?.isLeashed ?? false; } catch {}
    if (!leashed) {
      // Unleashed by hand close by is letting go; far away, the line broke.
      let near = false;
      try { near = dist(player.location, target.location) < line.length; } catch {}
      endLine(line, near ? 'released' : 'snapped');
      continue;
    }
    const a = speciesOf(target);
    const dead = !a || getState(target) === STATE.carcass;
    const head = player.getHeadLocation();
    const d = dist(head, target.location);
    const toPlayer = norm(sub(head, target.location));
    const kg = a ? weightOf(target, a) : 5;

    // Landed: a dead fish (or a carcass) reeled in to arm's length.
    if (dead && d <= LINE.landed) {
      endLine(line, 'landed');
      continue;
    }
    // A live fish fights the line in bursts, harder the bigger it is (less once badly wounded).
    if (!dead && now >= line.fightAt) {
      line.fightAt = now + 6 + Math.floor(Math.random() * 10);
      const strength = Math.max(0.4, Math.min(1.6, kg / 60)) * (getState(target) === STATE.wounded ? 0.6 : 1);
      const away = norm(add(scale(toPlayer, -1), { x: Math.random() - 0.5, y: (Math.random() - 0.5) * 0.4, z: Math.random() - 0.5 }));
      try { target.applyImpulse(scale(away, LINE.fight * strength)); } catch {}
    }
    // Reeling: hold sneak (or the submarine's winch does it).
    const reeling = line.winch ? line.winchOn : player.isSneaking;
    if (reeling && d > LINE.landed) {
      const pull = Math.max(0.03, (LINE.pull * (line.winch ? 1.5 : 1)) / Math.max(1, Math.sqrt(kg / 10)));
      try { target.applyImpulse(scale(toPlayer, pull)); } catch {}
    }
    // Too far for too long and the line snaps.
    if (d > line.length * 1.5) {
      endLine(line, 'snapped');
      continue;
    }
    line.taut = d > line.length ? line.taut + 1 : Math.max(0, line.taut - 2);
    if (line.taut > LINE.snapTicks) {
      endLine(line, 'snapped');
      continue;
    }
    // The submarine shows the line on its own panel.
    if (!line.winch && now % 5 === 0) {
      player.onScreenDisplay.setActionBar({
        translate: 'hunting.line.status',
        with: { rawtext: [{ text: String(Math.round(d)) }, { text: String(line.length) }, { translate: `hunting.line.${tension(d, line.length)}` }] },
      });
    }
  }
}

/** Line state for the submarine's panel. */
export function lineStatus(line) {
  try {
    const d = dist(line.player.getHeadLocation(), line.target.location);
    return { distance: Math.round(d), length: line.length, tension: tension(d, line.length) };
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- picking harpoons up

const STUCK = ['hunting:thrown_harpoon', 'hunting:harpoon_bolt'];

/** Swim or walk over a harpoon or bolt that has stopped, and it goes back in your inventory. */
function pickUp() {
  for (const player of world.getPlayers()) {
    for (const type of STUCK) {
      let found;
      try { found = player.dimension.getEntities({ type, location: player.location, maxDistance: 2 }); } catch { continue; }
      for (const p of found) {
        try {
          if (len(p.getVelocity()) > 0.02) continue; // still flying
          const item = p.getDynamicProperty(CREATIVE) ? undefined : returnItem(type, p.getDynamicProperty(DAMAGE));
          p.remove();
          if (item) give(player, item, player.location);
          player.playSound('random.pop', { pitch: 1.4, volume: 0.5 });
        } catch {}
      }
    }
  }
}

// ---------------------------------------------------------------- setup

export function setupHarpoons() {
  world.afterEvents.itemStartUse.subscribe(({ itemStack, source }) => {
    const id = itemStack?.typeId;
    if (!isPlayer(source) || (id !== 'hunting:harpoon' && id !== 'hunting:speargun')) return;
    const now = system.currentTick;
    // With a fish on the line, using the weapon lets go of the line instead.
    const line = lineOf(source);
    if (line && !line.winch) {
      system.run(() => endLine(line, 'released'));
      using.delete(source.id);
      return;
    }
    if (id === 'hunting:harpoon') {
      using.set(source.id, { kind: 'throw', since: now });
      return;
    }
    if (!isCreative(source) && !findItem(source, `hunting:${HARPOONS.speargun.ammo}`)) {
      source.onScreenDisplay.setActionBar({ translate: 'hunting.hud.no_ammo', with: { rawtext: [{ translate: `item.hunting:${HARPOONS.speargun.ammo}.name` }] } });
      return;
    }
    using.set(source.id, { kind: 'load', since: now });
    source.onScreenDisplay.setActionBar({ translate: 'hunting.hud.speargun_loading' });
    source.playSound('crossbow.loading.start');
  });
  world.afterEvents.itemStopUse.subscribe(({ source }) => {
    const u = using.get(source.id);
    if (!u || !isPlayer(source)) return;
    using.delete(source.id);
    const ticks = system.currentTick - u.since;
    system.run(() => {
      const held = heldItem(source);
      // Switching items stops using too: only act if the weapon is still in hand.
      if (u.kind === 'throw' && held?.typeId === 'hunting:harpoon') throwHarpoon(source, held, ticks);
      else if (u.kind === 'load' && held?.typeId === 'hunting:speargun' && ticks >= HARPOONS.speargun.loadTicks) loadSpeargun(source);
    });
  });
  world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    if (itemStack?.typeId !== 'hunting:speargun_loaded' || !isPlayer(source)) return;
    system.run(() => {
      // Still the loaded speargun in hand (two clicks in a tick, or a slot switch, mustn't fire twice).
      if (heldItem(source)?.typeId !== 'hunting:speargun_loaded') return;
      const line = lineOf(source);
      if (line && !line.winch) endLine(line, 'released');
      else fireSpeargun(source);
    });
  });
  world.afterEvents.playerLeave.subscribe(({ playerId }) => using.delete(playerId));
  world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
    const line = lines.get(removedEntityId);
    if (line) endLine(line, 'released');
  });
  system.runInterval(() => tickLines(system.currentTick), 1);
  system.runInterval(pickUp, 5);
}
