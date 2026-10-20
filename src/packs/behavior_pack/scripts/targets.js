// Other add-ons' creatures as game (Safari Animals, Prehistoric Dinosaurs...): they send
// a profile for each creature (game data and hit model, see lib/protocol.js) as script
// events. We ask for them on world load in case they loaded first.
import { system } from '@minecraft/server';
import { addTarget } from './game.js';
import { assembler, HELLO, REGISTER } from './lib/protocol.js';

export function setupTargets() {
  const receive = assembler((profile) => addTarget(profile));
  system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === REGISTER) receive(event.message);
  });
  system.sendScriptEvent(HELLO, '');
}
