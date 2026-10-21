import { ItemStack, system, world } from '@minecraft/server';
import { ANIMALS, CALIBRES, HARPOONS, ITEMS, ZONE_PRIORITY, ZONES } from './data.js';
import { windAt } from './lib/ballistics.js';
import { evaluate, toModel } from './lib/hitzones.js';
import { getState, hitModelOf, scaleOf, speciesOf, STATE, TARGETS } from './game.js';
import { trace } from './shooting.js';
import { applyHit, LAST_RUN } from './wounds.js';

/** Model space (pixels) -> world, the inverse of toModel. */
function toWorld(entity, a, p) {
  const k = scaleOf(entity, a) / 16;
  const r = (entity.getRotation().y * Math.PI) / 180;
  const f = { x: -Math.sin(r), z: Math.cos(r) };
  const right = { x: -Math.cos(r), z: -Math.sin(r) };
  const pos = entity.location;
  return {
    x: pos.x - p[0] * k * right.x - p[2] * k * f.x,
    y: pos.y + p[1] * k,
    z: pos.z - p[0] * k * right.z - p[2] * k * f.z,
  };
}

/** Centre of the first organ box of a zone, in model space. */
function organCentre(model, zone) {
  const o = model.organs.find((x) => x[3] === zone);
  if (!o) return null;
  const [m, min, max] = o;
  const c = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
  // m maps model -> box space and is rigid; invert: p = R^T (c - t).
  const t = [m[3], m[7], m[11]];
  const v = [c[0] - t[0], c[1] - t[1], c[2] - t[2]];
  return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];
}

/**
 * A traced rifle shot from 4 blocks through an animal's heart: must hit it, hit the heart
 * and (applied as a kill) turn it into a carcass. `expect` = 'perfect' also checks the grade.
 */
function shotTest(dim, animal, calibre, fail, expect) {
  const a = speciesOf(animal);
  const label = animal.typeId;
  system.runTimeout(() => {
    try {
      const model = hitModelOf(animal, a);
      const c = organCentre(model, 'heart');
      const heart = toWorld(animal, a, c);
      // From 4 blocks: closer than the next animal in bds-test.sh's grid (6 apart).
      const side = toWorld(animal, a, [c[0] + (16 * 4) / scaleOf(animal, a), c[1], c[2]]);
      const d = { x: heart.x - side.x, y: heart.y - side.y, z: heart.z - side.z };
      const len = Math.hypot(d.x, d.y, d.z);
      const dir = { x: d.x / len, y: d.y / len, z: d.z / len };
      // Bullets fly with drop and wind; a still-air rifle at 4 m drops a millimetre or so.
      const hit = trace(dim, side, dir, calibre, { x: 0, z: 0, speed: 0 }, undefined);
      if (hit.kind !== 'game' || hit.entity.id !== animal.id) fail.push(`${label}: traced shot did not hit it (${hit.kind}${hit.entity ? ` ${hit.entity.typeId}` : ''})`);
      else {
        if (!hit.report.zones.some((z) => z.zone === 'heart')) fail.push(`${label}: traced shot zones ${hit.report.zones.map((z) => z.zone)}`);
        if (expect && hit.report.grade !== expect) fail.push(`${label}: traced shot graded ${hit.report.grade}`);
        const fakePlayer = { id: 'selftest', location: side, sendMessage() {}, onScreenDisplay: { setActionBar() {} } };
        applyHit(animal, a, { ...hit.report, fate: 'kill' }, fakePlayer, 1);
      }
    } catch (e) {
      fail.push(`${label}: shot test threw ${e}`);
    }
  }, 2);
  // Even a kill runs a few steps first.
  system.runTimeout(() => {
    if (animal.isValid && getState(animal) === STATE.carcass) fail.push(`${label}: dropped on the spot`);
  }, 4);
  system.runTimeout(() => {
    if (!animal.isValid) fail.push(`${label}: gone after the shot`);
    else if (getState(animal) !== STATE.carcass) fail.push(`${label}: did not become a carcass`);
  }, 8 + LAST_RUN);
}

/**
 * Used by tools/bds-test.sh when other add-ons are loaded too. Message = space-separated
 * type ids (safari:zebra...) that must have registered as game; one of each in the world
 * is shot through the heart with the lightest ethical rifle and must grade perfect.
 */
export function selfTestTargets(message) {
  const fail = [];
  const dim = world.getDimension('overworld');
  const rifles = Object.entries(CALIBRES).filter(([, c]) => !c.pellets && !c.projectile && c.velocity > 500).sort((p, q) => p[1].energy - q[1].energy);
  for (const typeId of message.split(/\s+/).filter(Boolean)) {
    const a = TARGETS.get(typeId);
    if (!a) {
      fail.push(`${typeId}: not registered`);
      continue;
    }
    const animal = dim.getEntities({ type: typeId }).find((e) => getState(e) === STATE.calm && !e.getComponent('minecraft:is_baby'));
    if (!animal) {
      fail.push(`${typeId}: none in the world`);
      continue;
    }
    if (a.fish) {
      // Fish are speargun game (a rifle bullet stops at the water): just bring it down.
      const fakePlayer = { id: 'selftest', location: animal.location, sendMessage() {}, onScreenDisplay: { setActionBar() {} } };
      applyHit(animal, a, { hit: true, zones: [{ zone: 'heart', percent: 100 }], fate: 'kill', grade: 'perfect', bleedSeconds: 0 }, fakePlayer, 1);
      system.runTimeout(() => {
        if (!animal.isValid || getState(animal) !== STATE.carcass) fail.push(`${typeId}: did not become a carcass`);
      }, 8 + LAST_RUN);
      continue;
    }
    const [id, c] = rifles.find(([, r]) => r.energy >= a.game.minEnergy) ?? rifles[rifles.length - 1];
    shotTest(dim, animal, { ...c, id }, fail, 'perfect');
  }
  const registered = [...TARGETS.values()].filter((a) => a.foreign).length;
  system.runTimeout(() => {
    console.log(fail.length ? `[Realistic Hunting] target selftest FAIL (${registered} registered): ${fail.join('; ')}` : `[Realistic Hunting] target selftest PASS (${registered} registered)`);
  }, 12 + LAST_RUN);
}

/**
 * Used by tools/bds-test.sh. Message = space-separated expected entity ids. Checks that every
 * animal and item exists, that the hit zones classify shots correctly, and that a real traced
 * rifle shot through a summoned deer's heart is reported as a heart hit and brings it down.
 */
export function selfTest(message) {
  const expected = message.split(/\s+/).filter(Boolean);
  const fail = [];
  const counts = {};
  const dim = world.getDimension('overworld');
  for (const e of dim.getEntities()) {
    if (e.typeId.startsWith('hunting:')) counts[e.typeId] = (counts[e.typeId] ?? 0) + 1;
  }
  for (const id of expected) if (!counts[`hunting:${id}`]) fail.push(`missing ${id}`);
  for (const id of ITEMS) {
    try {
      new ItemStack(id, 1);
    } catch {
      fail.push(`item ${id}`);
    }
  }
  console.log(`[Realistic Hunting] selftest found ${JSON.stringify(counts)}`);

  // Pure hit-zone checks for every species: broadside through the heart, a leg, over the back.
  const c308 = CALIBRES.c308;
  for (const a of ANIMALS.filter((x) => x.game)) {
    const m = a.hitModel;
    const heart = organCentre(m, 'heart');
    const shot = (o, d) => evaluate({ model: m, zones: ZONES, priority: ZONE_PRIORITY, o, d, energy: c308.energy, penetration: c308.penetration, cmPerPx: 6.25 * (a.scale ?? 1), minEnergy: a.game.minEnergy });
    const fromLeft = shot([heart[0] + 60, heart[1], heart[2]], [-1, 0, 0]);
    if (!fromLeft.zones.some((z) => z.zone === 'heart')) fail.push(`${a.id}: broadside heart shot missed the heart (${fromLeft.zones.map((z) => z.zone)})`);
    if (fromLeft.fate === 'none' || fromLeft.fate === 'wound') fail.push(`${a.id}: heart shot not lethal (${fromLeft.fate})`);
    const over = shot([heart[0] + 60, m.bounds[1][1] + 8, heart[2]], [-1, 0, 0]);
    if (over.hit) fail.push(`${a.id}: shot over the back hit ${over.zones.map((z) => z.zone)}`);
  }

  // A speargun bolt through a fish's heart, under water, is lethal; fired through the air it goes less deep.
  const bolt = CALIBRES.harpoon_bolt;
  for (const a of ANIMALS.filter((x) => x.fish)) {
    const m = a.hitModel;
    const heart = organCentre(m, 'heart');
    const shot = (power) => evaluate({ model: m, zones: ZONES, priority: ZONE_PRIORITY, o: [heart[0] + 40, heart[1], heart[2]], d: [-1, 0, 0], energy: bolt.energy * power * power, penetration: bolt.penetration * power, cmPerPx: 6.25 * (a.scale ?? 1), minEnergy: 0, bigGame: true });
    const wet = shot(HARPOONS.speargun.powerWater);
    if (!wet.zones.some((z) => z.zone === 'heart') || !['kill', 'mortal'].includes(wet.fate)) fail.push(`${a.id}: harpoon heart shot ${wet.fate} (${wet.zones.map((z) => z.zone)})`);
    const dry = shot(HARPOONS.speargun.powerAir);
    const depth = (r) => r.zones.reduce((n, z) => n + z.percent, 0);
    if (depth(dry) > depth(wet)) fail.push(`${a.id}: a harpoon went deeper through the air`);
  }

  // Wind is deterministic.
  const w = windAt(123456);
  if (!(w.speed >= 0 && w.speed <= 10) || windAt(123456).x !== w.x) fail.push('wind');

  // A real traced shot through a deer standing in the world.
  const deer = dim.getEntities({ type: 'hunting:white_tailed_deer' }).find((e) => getState(e) === STATE.calm);
  if (!deer) fail.push('no deer for the shot test');
  else {
    if (deer.getComponent('minecraft:is_baby')) deer.triggerEvent('hunting:grow_up');
    shotTest(dim, deer, { ...c308, id: 'c308' }, fail);
  }
  system.runTimeout(() => {
    console.log(fail.length ? `[Realistic Hunting] selftest FAIL: ${fail.join('; ')}` : '[Realistic Hunting] selftest PASS');
  }, 12 + LAST_RUN);
}
