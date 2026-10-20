import { system, world } from '@minecraft/server';
import { setupDiving } from './diving.js';
import { setupDogs } from './dog.js';
import { setupGear } from './gear.js';
import { setupHarpoons } from './harpoon.js';
import { setupJournal } from './journal.js';
import { selfTest, selfTestTargets } from './selftest.js';
import { setupSenses } from './senses.js';
import { setupShooting } from './shooting.js';
import { registerSubmarinePlacer, setupSubmarine } from './submarine.js';
import { setupTargets } from './targets.js';
import { setupWounds } from './wounds.js';

// Custom item components have to be registered before the world loads.
registerSubmarinePlacer();

world.afterEvents.worldLoad.subscribe(() => {
  setupTargets();
  setupSenses();
  setupShooting();
  setupWounds();
  setupGear();
  setupJournal();
  setupDogs();
  setupHarpoons();
  setupDiving();
  setupSubmarine();
  console.log('[Realistic Hunting] loaded');
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === 'hunting:selftest') selfTest(event.message);
  if (event.id === 'hunting:selftest_targets') selfTestTargets(event.message);
});
