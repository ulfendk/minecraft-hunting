// The hunting dog: blow a dog whistle near your tame dog and it follows the trail to the
// nearest animal you wounded or brought down, and barks when it finds it. Shot birds it
// carries back to you.
import { system, world } from '@minecraft/server';
import { getState, nameOf, speciesOf, STATE } from './game.js';
import { dist } from './util.js';
import { placeCarcass } from './wounds.js';

const tracking = new Map(); // dog id -> { owner, since, carrying: { type, props } }

function ownedDogs(player) {
  try {
    return player.dimension.getEntities({ type: 'hunting:hunting_dog', location: player.location, maxDistance: 40 })
      .filter((d) => d.getComponent('minecraft:tameable')?.tamedToPlayerId === player.id);
  } catch {
    return [];
  }
}

function quarryNear(dog, player) {
  let best, bestD = Infinity;
  try {
    for (const e of dog.dimension.getEntities({ families: ['hunting_game'], location: dog.location, maxDistance: 160 })) {
      const st = getState(e);
      if (st < STATE.wounded || !speciesOf(e)) continue;
      const shooter = e.getDynamicProperty('hunting:shooter');
      if (st === STATE.carcass && shooter && shooter !== player.id) continue;
      const d = dist(e.location, dog.location);
      if (d < bestD) { best = e; bestD = d; }
    }
  } catch {}
  return best;
}

function whistle(player) {
  player.dimension.playSound('note.flute', player.location, { pitch: 2, volume: 3 });
  const dogs = ownedDogs(player);
  if (!dogs.length) {
    player.onScreenDisplay.setActionBar({ translate: 'hunting.dog.no_dog' });
    return;
  }
  const quarry = quarryNear(dogs[0], player);
  if (!quarry) {
    player.onScreenDisplay.setActionBar({ translate: 'hunting.dog.no_trail' });
    for (const d of dogs) d.dimension.playSound('mob.wolf.whine', d.location);
    return;
  }
  for (const dog of dogs) {
    try {
      dog.triggerEvent('hunting:track');
      tracking.set(dog.id, { owner: player.id, since: system.currentTick });
      dog.dimension.playSound('mob.wolf.bark', dog.location, { pitch: 1.1 });
    } catch {}
  }
  player.onScreenDisplay.setActionBar({ translate: 'hunting.dog.tracking' });
}

function stop(dog) {
  tracking.delete(dog.id);
  try { dog.triggerEvent('hunting:stop_track'); } catch {}
}

function tick() {
  const now = system.currentTick;
  for (const [id, t] of tracking) {
    const dog = world.getEntity(id);
    const owner = world.getEntity(t.owner);
    if (!dog?.isValid || !owner?.isValid) {
      tracking.delete(id);
      continue;
    }
    if (t.carrying) {
      // Bring the bird back and lay it at the owner's feet.
      if (dist(dog.location, owner.location) < 3.5) {
        placeCarcass(owner.dimension, owner.location, t.carrying);
        dog.dimension.playSound('mob.wolf.panting', dog.location);
        tracking.delete(id);
      } else if (now - t.since > 20 * 90) tracking.delete(id);
      continue;
    }
    if (now - t.since > 20 * 60) {
      stop(dog);
      continue;
    }
    let found;
    try {
      found = dog.dimension.getEntities({ families: ['hunting_game'], location: dog.location, maxDistance: 3 }).find((e) => getState(e) >= STATE.wounded);
    } catch {}
    if (!found) {
      if (now % 40 === 0) dog.dimension.playSound('mob.fox.sniff', dog.location, { pitch: 0.8 });
      continue;
    }
    const a = speciesOf(found);
    dog.dimension.playSound('mob.wolf.bark', dog.location, { volume: 3 });
    owner.onScreenDisplay.setActionBar({ translate: 'hunting.dog.found', with: { rawtext: [nameOf(a.id)] } });
    stop(dog);
    // Birds are fetched.
    if (a.bird && getState(found) === STATE.carcass) {
      const props = {};
      for (const k of found.getDynamicPropertyIds()) props[k] = found.getDynamicProperty(k);
      let variant = 0;
      try { variant = found.getComponent('minecraft:variant')?.value ?? 0; } catch {}
      tracking.set(id, { owner: t.owner, since: now, carrying: { type: found.typeId, props, variant } });
      found.remove();
    }
  }
}

export function setupDogs() {
  world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    if (itemStack?.typeId !== 'hunting:dog_whistle' || source.typeId !== 'minecraft:player') return;
    system.run(() => whistle(source));
  });
  system.runInterval(tick, 10);
}
