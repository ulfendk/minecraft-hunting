// The mini submarine. Use the item on water to put it in; use it again (interact) to board.
// Move forward to go where you look (look down to dive), jump to rise, sneak to get out.
// It runs on a battery: redstone charges it, and when it is flat the sub floats up. Under
// water the pilot breathes and sees clearly, the lamps come on in the deep or at night, and
// using a harpoon bolt fires the launcher in the nose; its winch reels a speared fish in.
// entity/MiniSubmarine.java is the Java twin.
import { system, world } from '@minecraft/server';
import { SUB } from './data.js';
import { refillTank } from './diving.js';
import { launch, lineOf, lineStatus, setWinch } from './harpoon.js';
import { makeNoise } from './senses.js';
import { add, consumeOne, findItem, isCreative, len, scale, waterAt } from './util.js';

const ID = 'hunting:mini_submarine';
const BATTERY = 'hunting:battery';
const FACES = { Up: [0, 1, 0], Down: [0, -1, 0], North: [0, 0, -1], South: [0, 0, 1], East: [1, 0, 0], West: [-1, 0, 0] };

const subs = new Map(); // sub id -> { v, battery, thrust, lights, firedAt, flat, savedAt }
const helped = new Set(); // players who have seen the controls

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function stateOf(sub) {
  let s = subs.get(sub.id);
  if (!s) {
    let battery = SUB.battery;
    try {
      const saved = sub.getDynamicProperty(BATTERY);
      if (typeof saved === 'number') battery = saved;
    } catch {}
    s = { v: { x: 0, y: 0, z: 0 }, battery, thrust: 0, lights: false, firedAt: -999, flat: battery <= 0, savedAt: 0 };
    subs.set(sub.id, s);
  }
  return s;
}

/** The pilot: the sub's rider, if it is a player. */
export function pilotOf(sub) {
  try {
    const r = sub.getComponent('minecraft:rideable')?.getRiders()[0];
    return r?.typeId === 'minecraft:player' ? r : undefined;
  } catch {
    return undefined;
  }
}

/** The sub a player is piloting. */
export function subOf(player) {
  try {
    const e = player.getComponent('minecraft:riding')?.entityRidingOn;
    return e?.typeId === ID ? e : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- placing

function place(player) {
  const eye = player.getHeadLocation();
  let hit;
  try { hit = player.dimension.getBlockFromRay(eye, player.getViewDirection(), { maxDistance: 6, includeLiquidBlocks: true, includePassableBlocks: true }); } catch {}
  if (!hit) return;
  // Still holding the sub (the slot may have changed since the click).
  const c = player.getComponent('minecraft:inventory').container;
  if (c.getItem(player.selectedSlotIndex)?.typeId !== ID) return;
  const b = hit.block.location;
  const water = waterAt(player.dimension, b);
  const [dx, dy, dz] = water ? [0, 0, 0] : FACES[hit.face] ?? [0, 1, 0];
  const at = { x: b.x + dx + 0.5, y: b.y + dy, z: b.z + dz + 0.5 };
  try {
    const sub = player.dimension.spawnEntity(ID, at);
    sub.setRotation({ x: 0, y: player.getRotation().y });
  } catch {
    return;
  }
  if (!isCreative(player)) {
    const container = player.getComponent('minecraft:inventory').container;
    const held = container.getItem(player.selectedSlotIndex);
    if (held?.typeId === ID) consumeOne({ container, slot: player.selectedSlotIndex, item: held });
  }
  player.dimension.playSound(water ? 'bucket.empty_water' : 'random.anvil_land', at, { pitch: 1.2, volume: 0.6 });
}

/** Item custom components have to be registered before the world loads. */
export function registerSubmarinePlacer() {
  system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
    itemComponentRegistry.registerCustomComponent('hunting:submarine_placer', {
      onUse({ source }) {
        if (source?.typeId === 'minecraft:player') system.run(() => place(source));
      },
    });
  });
}

// ---------------------------------------------------------------- driving

/** Water depth above a point, in blocks (0 at the surface). */
function depthAt(dimension, loc) {
  let d = 0;
  while (d < 64 && waterAt(dimension, { x: loc.x, y: loc.y + d + 1, z: loc.z })) d++;
  return d;
}

function drive(sub, s, pilot, now) {
  const dim = sub.dimension;
  const loc = sub.location;
  const mid = { x: loc.x, y: loc.y + SUB.size[1] * 0.5, z: loc.z };
  const wet = waterAt(dim, mid);
  const surfaced = wet && !waterAt(dim, { x: loc.x, y: loc.y + SUB.size[1] + 0.1, z: loc.z });
  const powered = s.battery > 0;

  let throttle = 0, up = false;
  if (pilot && powered) {
    try {
      throttle = clamp(pilot.inputInfo.getMovementVector().y, -0.5, 1);
      up = pilot.inputInfo.getButtonState('Jump') === 'Pressed';
    } catch {}
  }

  const v = s.v;
  if (wet) {
    // Thrust along where the pilot looks; Jump adds lift. A flat battery floats it up slowly.
    let target = { x: 0, y: powered ? 0 : 0.04, z: 0 };
    if (pilot && throttle !== 0) target = scale(pilot.getViewDirection(), throttle * SUB.speed);
    if (up) target.y = Math.max(target.y, SUB.vertical);
    if (surfaced) target.y = Math.min(target.y, 0);
    for (const k of ['x', 'y', 'z']) {
      const dv = target[k] - v[k];
      v[k] += clamp(dv, -SUB.accel, SUB.accel);
      if (target[k] === 0) v[k] *= SUB.drag;
    }
  } else {
    // Out of the water it is just a heavy lump.
    v.x *= 0.5;
    v.z *= 0.5;
    v.y = sub.isOnGround && v.y < 0 ? 0 : Math.max(-1, v.y - 0.08);
  }
  try {
    sub.clearVelocity();
    sub.applyImpulse(v);
  } catch {}

  if (pilot) {
    // Turn towards where the pilot looks.
    const yaw = sub.getRotation().y, want = pilot.getRotation().y;
    const delta = ((want - yaw + 540) % 360) - 180;
    if (Math.abs(delta) > 0.5) try { sub.setRotation({ x: 0, y: yaw + clamp(delta, -SUB.turn, SUB.turn) }); } catch {}
  }

  // Battery, propeller, lamps.
  if (pilot && powered) {
    const line = lineOf(pilot);
    const winching = !!line?.winch;
    s.battery = Math.max(0, s.battery - SUB.drain.idle - SUB.drain.thrust * Math.abs(throttle) - (s.lights ? SUB.drain.lights : 0) - (winching ? SUB.drain.thrust * 0.5 : 0));
    setWinch(pilot, s.battery > 0);
    if (s.battery <= 0 && !s.flat) {
      s.flat = true;
      pilot.onScreenDisplay.setActionBar({ translate: 'hunting.sub.flat' });
      dim.playSound('note.bass', loc, { pitch: 0.5 });
    }
  } else if (pilot) {
    setWinch(pilot, false);
  }
  const thrust = Math.round(Math.abs(throttle) * 10);
  if (thrust !== s.thrust) {
    s.thrust = thrust;
    try { sub.setProperty('hunting:thrust', thrust); } catch {}
  }
  if (now % 10 === 0) {
    const time = world.getTimeOfDay();
    const night = time > 13000 && time < 23000;
    const depth = wet ? depthAt(dim, mid) : 0;
    s.depth = depth;
    const lights = !!pilot && powered && wet && (depth >= SUB.lightsBelow || night);
    if (lights !== s.lights) {
      s.lights = lights;
      try { sub.setProperty('hunting:lights', lights); } catch {}
    }
    if (pilot && powered && wet) {
      try {
        pilot.addEffect('conduit_power', 40, { amplifier: 0, showParticles: false });
        if (lights) pilot.addEffect('night_vision', 400, { amplifier: 0, showParticles: false });
      } catch {}
      if (now % 20 === 0) refillTank(pilot);
    }
    if (pilot && thrust > 3 && now % 20 === 0) makeNoise(pilot, 8);
  }
  if (now - s.savedAt > 40) {
    s.savedAt = now;
    try { sub.setDynamicProperty(BATTERY, s.battery); } catch {}
  }
  if (pilot && now % 5 === 0) hud(pilot, s);
}

function hud(pilot, s) {
  const speed = (len(s.v) * 20).toFixed(1);
  const parts = [{
    translate: 'hunting.sub.hud',
    with: { rawtext: [{ text: String(Math.ceil((100 * s.battery) / SUB.battery)) }, { text: String(s.depth ?? 0) }, { text: speed }] },
  }];
  let bolts = 0;
  try {
    const c = pilot.getComponent('minecraft:inventory').container;
    for (let i = 0; i < c.size; i++) {
      const it = c.getItem(i);
      if (it?.typeId === `hunting:${SUB.launcher.ammo}`) bolts += it.amount;
    }
  } catch {}
  parts.push({ text: ' · ' }, { translate: 'hunting.sub.bolts', with: [String(bolts)] });
  if (s.lights) parts.push({ text: ' · ' }, { translate: 'hunting.sub.lights' });
  const line = lineOf(pilot);
  const st = line && lineStatus(line);
  if (st) {
    parts.push({ text: '\n' }, {
      translate: 'hunting.line.status',
      with: { rawtext: [{ text: String(st.distance) }, { text: String(Math.round(st.length)) }, { translate: `hunting.line.${st.tension}` }] },
    });
  }
  pilot.onScreenDisplay.setActionBar({ rawtext: parts });
}

// ---------------------------------------------------------------- launcher and charging

function fire(pilot, sub) {
  const s = stateOf(sub);
  const now = system.currentTick;
  if (now - s.firedAt < SUB.launcher.cooldown) {
    pilot.onScreenDisplay.setActionBar({ translate: 'hunting.sub.reloading' });
    return;
  }
  if (!isCreative(pilot)) {
    const bolt = findItem(pilot, `hunting:${SUB.launcher.ammo}`);
    if (!bolt) {
      pilot.onScreenDisplay.setActionBar({ translate: 'hunting.sub.no_bolts' });
      return;
    }
    consumeOne(bolt);
  }
  s.firedAt = now;
  const r = (sub.getRotation().y * Math.PI) / 180;
  const forward = { x: -Math.sin(r), y: 0, z: Math.cos(r) };
  const nose = add(sub.location, add(scale(forward, SUB.size[0] * 0.5 + 0.9), { x: 0, y: 0.15, z: 0 }));
  const wet = waterAt(sub.dimension, nose);
  launch(sub.dimension, `hunting:${SUB.launcher.projectile}`, nose, pilot.getViewDirection(), SUB.launcher.speed * (wet ? 1 : 0.6), pilot, {
    power: wet ? SUB.launcher.power : SUB.launcher.power * 0.45,
    winch: true,
  });
  sub.dimension.playSound('crossbow.shoot', nose, { pitch: 0.6 });
  makeNoise(pilot, 5);
}

function charge(player, sub, item) {
  const s = stateOf(sub);
  const amount = SUB.charge[item.typeId];
  if (s.battery >= SUB.battery - 1) {
    player.onScreenDisplay.setActionBar({ translate: 'hunting.sub.full' });
    return;
  }
  if (!isCreative(player)) {
    // Only charge for redstone actually used up.
    const c = player.getComponent('minecraft:inventory').container;
    const held = c.getItem(player.selectedSlotIndex);
    if (held?.typeId !== item.typeId) return;
    consumeOne({ container: c, slot: player.selectedSlotIndex, item: held });
  }
  s.battery = Math.min(SUB.battery, s.battery + amount);
  s.flat = false;
  try { sub.setDynamicProperty(BATTERY, s.battery); } catch {}
  player.onScreenDisplay.setActionBar({ translate: 'hunting.sub.charged', with: [String(Math.round((100 * s.battery) / SUB.battery))] });
  sub.dimension.playSound('random.orb', sub.location, { pitch: 1.6 });
}

// ---------------------------------------------------------------- setup

export function setupSubmarine() {
  system.runInterval(() => {
    const now = system.currentTick;
    const seen = new Set();
    for (const player of world.getPlayers()) {
      let found;
      try { found = player.dimension.getEntities({ type: ID, location: player.location, maxDistance: 96 }); } catch { continue; }
      for (const sub of found) {
        if (seen.has(sub.id)) continue;
        seen.add(sub.id);
        const pilot = pilotOf(sub);
        if (pilot && !helped.has(pilot.id)) {
          helped.add(pilot.id);
          pilot.sendMessage({ translate: 'hunting.sub.help' });
        }
        drive(sub, stateOf(sub), pilot, now);
      }
    }
  }, 1);
  world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    if (itemStack?.typeId !== `hunting:${SUB.launcher.ammo}` || source.typeId !== 'minecraft:player') return;
    const sub = subOf(source);
    if (sub && pilotOf(sub)?.id === source.id) system.run(() => fire(source, sub));
  });
  // Redstone on the sub charges its battery instead of boarding it.
  world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
    if (e.target?.typeId !== ID || !e.itemStack || !SUB.charge[e.itemStack.typeId]) return;
    e.cancel = true;
    const { player, target, itemStack } = e;
    system.run(() => charge(player, target, itemStack));
  });
  // A creative player breaks it at once, without dropping it.
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
    const by = damageSource.damagingEntity;
    if (by?.typeId === 'minecraft:player' && isCreative(by)) try { hurtEntity.remove(); } catch {}
  }, { entityTypes: [ID] });
  world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => subs.delete(removedEntityId));
}
