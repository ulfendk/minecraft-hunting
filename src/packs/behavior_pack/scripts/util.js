export const chance = (p) => Math.random() < p;

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const norm = (a) => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

/** Per-entity cooldowns kept in memory (they reset when the world reloads, which is fine). */
const cooldowns = new Map();
export function ready(entity, key, ticks, now) {
  const k = `${entity.id}:${key}`;
  const until = cooldowns.get(k) ?? 0;
  if (now < until) return false;
  cooldowns.set(k, now + ticks);
  return true;
}

/** Find an item in a player's inventory: returns { container, slot, item } or undefined. */
export function findItem(player, typeId) {
  const container = player.getComponent('minecraft:inventory')?.container;
  if (!container) return undefined;
  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (item?.typeId === typeId) return { container, slot, item };
  }
  return undefined;
}

/** Remove one of an item from a slot found by findItem. */
export function consumeOne({ container, slot, item }) {
  if (item.amount > 1) {
    item.amount -= 1;
    container.setItem(slot, item);
  } else container.setItem(slot, undefined);
}

export function isCreative(player) {
  try {
    return String(player.getGameMode()).toLowerCase() === 'creative';
  } catch {
    return false;
  }
}

/** Wear down the item in the player's selected slot. */
export function wearSelected(player, amount = 1) {
  try {
    if (isCreative(player)) return;
    const container = player.getComponent('minecraft:inventory').container;
    const slot = player.selectedSlotIndex;
    const item = container.getItem(slot);
    const d = item?.getComponent('minecraft:durability');
    if (!d) return;
    if (d.damage + amount >= d.maxDurability) {
      container.setItem(slot, undefined);
      player.playSound('random.break');
    } else {
      d.damage += amount;
      container.setItem(slot, item);
    }
  } catch {}
}

export function heldItem(player) {
  try {
    return player.getComponent('minecraft:inventory').container.getItem(player.selectedSlotIndex);
  } catch {
    return undefined;
  }
}
