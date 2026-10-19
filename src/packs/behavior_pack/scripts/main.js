import { system, world } from '@minecraft/server';
import { setupDogs } from './dog.js';
import { setupGear } from './gear.js';
import { setupJournal } from './journal.js';
import { selfTest } from './selftest.js';
import { setupSenses } from './senses.js';
import { setupShooting } from './shooting.js';
import { setupWounds } from './wounds.js';

world.afterEvents.worldLoad.subscribe(() => {
  setupSenses();
  setupShooting();
  setupWounds();
  setupGear();
  setupJournal();
  setupDogs();
  console.log('[Realistic Hunting] loaded');
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === 'hunting:selftest') selfTest(event.message);
});
