// Diving gear. A snorkel lets you breathe while your head is just under the surface. A dive
// mask with a scuba tank lets you breathe anywhere under water (and see clearly) until the
// tank is empty; the tank's durability bar is the air left, and it fills up again out of the
// water. The dive knife cuts harder under water. hunt/Diving.java is the Java twin.
//
// Scripts can't set a player's air on Bedrock, so working gear keeps a short water
// breathing (snorkel) or conduit power (mask and tank) effect going instead.
import { system, world } from '@minecraft/server';
import { DIVE } from './data.js';
import { lineOf } from './harpoon.js';
import { isScoped } from './shooting.js';
import { eyeInWater, heldItem, isCreative, waterAt } from './util.js';

const STEP = 10; // ticks between checks
const lowWarned = new Set(); // players told their tank is empty
let steps = 0; // ticks run, counted in STEPs (every second step is a second)

const equipment = (player, slot) => {
  try {
    return player.getComponent('minecraft:equippable')?.getEquipment(slot);
  } catch {
    return undefined;
  }
};

function breathe(player, effect) {
  try { player.addEffect(effect, STEP + 20, { amplifier: 0, showParticles: false }); } catch {}
}

/** Seconds of air left in a scuba tank item. An empty tank stops one short of breaking. */
export function tankAir(item) {
  const d = item?.getComponent('minecraft:durability');
  return d ? d.maxDurability - 1 - d.damage : 0;
}

function setTank(player, item, air) {
  const d = item.getComponent('minecraft:durability');
  const damage = Math.max(0, Math.min(d.maxDurability - 1, Math.round(d.maxDurability - 1 - air)));
  if (damage === d.damage) return;
  d.damage = damage;
  try { player.getComponent('minecraft:equippable').setEquipment('Chest', item); } catch {}
}

/** A submarine tops the tank up (scripts/submarine.js). */
export function refillTank(player) {
  const tank = equipment(player, 'Chest');
  if (tank?.typeId === 'hunting:scuba_tank') setTank(player, tank, DIVE.tankSeconds);
}

function tick() {
  const second = ++steps % 2 === 0;
  for (const player of world.getPlayers()) {
    const head = equipment(player, 'Head')?.typeId;
    const tank = equipment(player, 'Chest');
    const hasTank = tank?.typeId === 'hunting:scuba_tank';
    const under = eyeInWater(player);
    const quiet = player.getComponent('minecraft:riding') || lineOf(player) || isScoped(player);

    if (head === 'hunting:snorkel' && under) {
      // The tube reaches the surface while the water above your eyes is shallow.
      const eye = player.getHeadLocation();
      if (!waterAt(player.dimension, { x: eye.x, y: eye.y + DIVE.snorkelClearance, z: eye.z })) breathe(player, 'water_breathing');
    }

    if (!hasTank) continue;
    let air = tankAir(tank);
    if (under && head === 'hunting:dive_mask') {
      if (air > 0) {
        breathe(player, 'conduit_power');
        // A second of air every second (the durability only counts whole seconds).
        if (!isCreative(player) && second) air -= 1;
        lowWarned.delete(player.id);
        if (!quiet && second) {
          const s = String(Math.ceil(air));
          player.onScreenDisplay.setActionBar({ translate: air < 60 ? 'hunting.hud.tank_low' : 'hunting.hud.tank', with: [s] });
        }
      } else if (!lowWarned.has(player.id)) {
        lowWarned.add(player.id);
        player.onScreenDisplay.setActionBar({ translate: 'hunting.hud.tank_empty' });
        player.playSound('note.bass', { pitch: 0.5 });
      }
    } else if (!under) {
      air = Math.min(DIVE.tankSeconds, air + (DIVE.refillPerSecond * STEP) / 20);
    }
    setTank(player, tank, air);
  }
}

export function setupDiving() {
  system.runInterval(tick, STEP);
  // The dive knife is made for cutting under water.
  world.afterEvents.entityHitEntity.subscribe(({ damagingEntity, hitEntity }) => {
    if (damagingEntity?.typeId !== 'minecraft:player') return;
    if (heldItem(damagingEntity)?.typeId !== 'hunting:dive_knife' || !eyeInWater(damagingEntity)) return;
    if (hitEntity?.typeId === 'hunting:mini_submarine') return;
    // After the hit's damage immunity has worn off, or the extra cut would be ignored.
    system.runTimeout(() => {
      try { if (hitEntity.isValid) hitEntity.applyDamage(DIVE.knifeBonus, { cause: 'entityAttack', damagingEntity }); } catch {}
    }, 11);
  });
}
