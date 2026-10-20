// Hunting gear: binoculars (zoom and range finder), wind checker, game calls and scent eliminator.
import { MolangVariableMap, system, world } from '@minecraft/server';
import { compass, windStrength } from './lib/ballistics.js';
import { gameEntities, gameInView, getState, isBaby, isMale, nameOf, speciesOf, STATE, trigger, wind } from './game.js';
import { applyScentEliminator, makeNoise } from './senses.js';
import { consumeOne, dist, findItem, heldItem, isCreative, wearSelected } from './util.js';

const glassing = new Set(); // players looking through binoculars

const windText = (w) => ({
  translate: 'hunting.wind.reading',
  with: { rawtext: [{ translate: `hunting.wind.${compass(w.from)}` }, { text: w.speed.toFixed(1) }, { translate: `hunting.wind.strength.${windStrength(w.speed)}` }] },
});

/** Puffs of powder drift away downwind. */
function checkWind(player) {
  const w = wind();
  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  const at = { x: eye.x + dir.x * 0.8, y: eye.y - 0.2, z: eye.z + dir.z * 0.8 };
  const speed = Math.max(0.05, w.speed / 10);
  for (let i = 0; i < 8; i++) {
    system.runTimeout(() => {
      try {
        const vars = new MolangVariableMap();
        vars.setSpeedAndDirection('variable.wind', speed, { x: w.x / Math.max(0.1, w.speed), y: 0.05, z: w.z / Math.max(0.1, w.speed) });
        player.dimension.spawnParticle('hunting:wind_puff', at, vars);
      } catch {}
    }, i * 2);
  }
  player.onScreenDisplay.setActionBar({ rawtext: [windText(w)] });
  player.playSound('random.pop', { pitch: 0.6, volume: 0.4 });
  wearSelected(player, 1);
}

/** Calls bring the species that answer to them a little closer. */
const CALLS = { deer_call: ['deer', 'mob.goat.ambient', 0.55], duck_call: ['duck', 'mob.chicken.say', 0.7], predator_call: ['predator', 'mob.rabbit.hurt', 1.5] };

function blowCall(player, id) {
  const [kind, sound, pitch] = CALLS[id];
  player.dimension.playSound(sound, player.location, { pitch, volume: 4 });
  makeNoise(player, 6);
  let marker;
  try {
    marker = player.dimension.spawnEntity('hunting:lure_marker', player.location);
  } catch {}
  if (!marker) return;
  for (const e of gameEntities(player.dimension, { location: player.location, maxDistance: 72 })) {
    const a = speciesOf(e);
    if (!a || a.game.call !== kind || getState(e) !== STATE.calm) continue;
    trigger(e, a, 'lure');
    system.runTimeout(() => {
      if (e.isValid) trigger(e, a, 'unlure');
    }, 20 * 25);
  }
  player.onScreenDisplay.setActionBar({ translate: 'hunting.call.used', with: { rawtext: [{ translate: `item.hunting:${id}.name` }] } });
}

function useScent(player) {
  if (!isCreative(player)) {
    const s = findItem(player, 'hunting:scent_eliminator');
    if (s) consumeOne(s);
  }
  applyScentEliminator(player);
  player.playSound('random.fizz', { pitch: 1.6, volume: 0.6 });
  player.onScreenDisplay.setActionBar({ translate: 'hunting.scent.applied' });
}

/** What the binoculars are pointed at: species, distance, sex and mood, or just the range. */
function glass(player) {
  const eye = player.getHeadLocation();
  let text;
  try {
    const hit = gameInView(player, 256);
    const a = hit && speciesOf(hit.entity);
    if (a) {
      const e = hit.entity;
      const sex = a.game.maleTrophy && !isBaby(e) ? [{ text: ' (' }, { translate: isMale(e) ? 'hunting.hud.buck' : 'hunting.hud.doe' }, { text: ')' }] : [];
      text = {
        rawtext: [
          { translate: 'hunting.hud.binoculars', with: { rawtext: [{ rawtext: [nameOf(a.id), ...sex] }, { text: String(Math.round(hit.distance)) }, { translate: `hunting.hud.state.${getState(e)}` }] } },
        ],
      };
    }
  } catch {}
  if (!text) {
    try {
      const b = player.dimension.getBlockFromRay(eye, player.getViewDirection(), { maxDistance: 320, includeLiquidBlocks: true, includePassableBlocks: false });
      if (b) {
        const p = { x: b.block.location.x + b.faceLocation.x, y: b.block.location.y + b.faceLocation.y, z: b.block.location.z + b.faceLocation.z };
        text = { translate: 'hunting.hud.binoculars.none', with: [String(Math.round(dist(eye, p)))] };
      }
    } catch {}
  }
  if (text) player.onScreenDisplay.setActionBar(text);
}

export function setupGear() {
  world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    const id = itemStack?.typeId;
    if (source.typeId !== 'minecraft:player' || !id?.startsWith('hunting:')) return;
    const name = id.slice(8);
    if (name === 'wind_checker') system.run(() => checkWind(source));
    else if (CALLS[name]) system.run(() => blowCall(source, name));
    else if (name === 'scent_eliminator') system.run(() => useScent(source));
  });
  world.afterEvents.itemStartUse.subscribe(({ itemStack, source }) => {
    if (itemStack?.typeId !== 'hunting:binoculars') return;
    glassing.add(source.id);
    try { source.runCommand('camera @s fov_set 20 0.2'); } catch {}
    source.playSound('item.spyglass.use');
  });
  world.afterEvents.itemStopUse.subscribe(({ itemStack, source }) => {
    if (itemStack?.typeId !== 'hunting:binoculars' || !glassing.delete(source.id)) return;
    try { source.runCommand('camera @s fov_clear 0.2'); } catch {}
    source.playSound('item.spyglass.stop_using');
  });
  system.runInterval(() => {
    for (const player of world.getPlayers()) {
      if (!glassing.has(player.id)) continue;
      if (heldItem(player)?.typeId !== 'hunting:binoculars') {
        glassing.delete(player.id);
        try { player.runCommand('camera @s fov_clear 0.2'); } catch {}
        continue;
      }
      glass(player);
    }
  }, 4);
}

export { windText };
