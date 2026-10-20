// What a hit does to a game animal: drops it on the spot, lets it run and bleed out, or
// leaves it wounded. Wounded animals leave a blood trail. A dead game animal stays as a
// carcass until it is field dressed with a knife (meat, hide and trophy).
import { ItemStack, MolangVariableMap, system, world } from '@minecraft/server';
import { KNIVES, ZONES } from './data.js';
import { getState, isBaby, isMale, nameOf, setState, sizeOf, speciesOf, STATE, trigger, weightOf } from './game.js';
import { bloodOf, recordTrophy, shotsOf } from './report.js';
import { spook } from './senses.js';
import { heldItem, wearSelected } from './util.js';

const bleeding = new Map(); // entity id -> { until, blood, shooter, shotId, drip, recoverAt }
const trails = []; // { dimension, location, until, blood }
const TRAIL_TICKS = 20 * 60 * 10;
const DRIP = { bright: 10, frothy: 10, gills: 10, dark: 14, gut: 24, little: 40, none: 0 };

const GRADE_FACTOR = { perfect: 1, good: 0.95, poor: 0.85, unethical: 0.7, miss: 0.7 };

function drip(entity, blood) {
  if (!DRIP[blood]) return;
  try {
    const loc = entity.location;
    trails.push({ dimension: entity.dimension, location: { x: loc.x, y: Math.floor(loc.y) + 0.05, z: loc.z }, until: system.currentTick + TRAIL_TICKS, blood });
    if (trails.length > 600) trails.splice(0, trails.length - 600);
  } catch {}
}

/** Re-show blood drops near players (particles fade, the trail doesn't). Crouching makes them stand out. */
function showTrails(now) {
  for (let i = trails.length - 1; i >= 0; i--) if (trails[i].until < now) trails.splice(i, 1);
  for (const player of world.getPlayers()) {
    const p = player.location;
    const id = player.isSneaking ? 'hunting:blood_glow' : 'hunting:blood';
    for (const t of trails) {
      if (t.dimension.id !== player.dimension.id) continue;
      const d = Math.hypot(t.location.x - p.x, t.location.z - p.z);
      if (d > 24) continue;
      try {
        const vars = new MolangVariableMap();
        vars.setFloat('variable.dark', t.blood === 'dark' || t.blood === 'gut' ? 1 : 0);
        player.spawnParticle(id, t.location, vars);
      } catch {}
    }
  }
}

/** Turn a game animal into a carcass where it stands. */
export function becomeCarcass(entity, a, shooter, shotId) {
  try {
    if (getState(entity) === STATE.carcass) return;
    trigger(entity, a, 'carcass');
    setState(entity, STATE.carcass);
    entity.removeEffect('slowness');
    entity.clearVelocity();
    const health = entity.getComponent('minecraft:health');
    health?.resetToMaxValue();
    if (shooter) entity.setDynamicProperty('hunting:shooter', shooter);
    if (shotId) entity.setDynamicProperty('hunting:shot', shotId);
    if (a.sounds?.death) entity.dimension.playSound(a.sounds.death, entity.location);
  } catch {}
  bleeding.delete(entity.id);
}

/**
 * Apply an evaluated shot to an animal.
 *   report  evaluate() result (fate, bleedSeconds, zones, grade)
 *   player  the shooter; shotId the stored report id
 */
export function applyHit(entity, a, report, player, shotId) {
  const now = system.currentTick;
  if (!report.hit) {
    spook(entity, a, now);
    return;
  }
  const blood = bloodOf(report);
  try { entity.setDynamicProperty('hunting:grade', report.grade); } catch {}
  if (report.fate === 'kill') {
    becomeCarcass(entity, a, player.id, shotId);
    return;
  }
  const health = entity.getComponent('minecraft:health');
  const max = health?.effectiveMax ?? a.health;
  let damage = 0;
  for (const z of report.zones) damage += (ZONES[z.zone]?.damage ?? 0) * (z.percent / 100) * max * 0.6;
  const prev = bleeding.get(entity.id);
  if (report.fate === 'none' && !prev) {
    spook(entity, a, now);
    return;
  }
  // A second wound on an already wounded animal can finish it.
  if (health && (prev || report.fate === 'wound') && health.currentValue - damage <= 0) {
    becomeCarcass(entity, a, player.id, shotId);
    return;
  }
  try {
    if (health && damage > 0) health.setCurrentValue(Math.max(1, health.currentValue - damage));
    entity.applyDamage(0.01, { cause: 'projectile', damagingEntity: player });
  } catch {}
  const slows = Math.max(...report.zones.map((z) => ZONES[z.zone]?.slows ?? 0), 0);
  const rec = {
    until: report.fate === 'mortal' ? now + Math.round(report.bleedSeconds * 20) : prev?.until ?? Infinity,
    blood: blood !== 'none' ? blood : prev?.blood ?? 'little',
    shooter: player.id,
    shotId,
    slows: Math.max(slows, prev?.slows ?? 0),
    recoverAt: report.fate === 'wound' && !prev?.until ? now + 20 * 90 : prev?.recoverAt,
  };
  if (report.fate === 'mortal') rec.recoverAt = undefined;
  bleeding.set(entity.id, rec);
  setState(entity, STATE.wounded);
  spook(entity, a, now);
}

function tickWounded(now) {
  for (const [id, rec] of bleeding) {
    const e = world.getEntity(id);
    if (!e?.isValid) {
      bleeding.delete(id);
      continue;
    }
    const a = speciesOf(e);
    if (!a) continue;
    if (now % 10 === 0) drip(e, rec.blood);
    if (rec.slows > 0) {
      try { e.addEffect('slowness', 30, { amplifier: rec.slows > 0.5 ? 2 : 1, showParticles: false }); } catch {}
    }
    if (rec.until !== Infinity && now >= rec.until) {
      becomeCarcass(e, a, rec.shooter, rec.shotId);
      continue;
    }
    if (rec.recoverAt && now >= rec.recoverAt) {
      bleeding.delete(id);
      setState(e, STATE.calm);
    }
  }
}

/** Lay down a carcass that was carried somewhere (the dog fetching a bird). */
export function placeCarcass(dimension, location, { type, props, variant }) {
  try {
    const e = dimension.spawnEntity(type, location);
    const ns = type.split(':')[0];
    // Other add-ons' carcass events keep a young animal young; ours turns it into an adult.
    if (ns === 'hunting' && e.getComponent('minecraft:is_baby')) e.triggerEvent('hunting:grow_up');
    if (variant) try { e.triggerEvent(`${ns}:make_variant_${variant}`); } catch {}
    for (const [k, v] of Object.entries(props ?? {})) e.setDynamicProperty(k, v);
    trigger(e, speciesOf(e), 'carcass');
    setState(e, STATE.carcass);
  } catch {}
}

// ---------------------------------------------------------------- field dressing

const TROPHY_FOR_FEMALES = new Set(['trophy_skull', 'trophy_tusks']);

function fieldDress(player, carcass) {
  const a = speciesOf(carcass);
  if (!a) return;
  const held = heldItem(player);
  if (!KNIVES.includes(held?.typeId)) {
    player.onScreenDisplay.setActionBar({ translate: 'hunting.dress.need_knife' });
    return;
  }
  const grade = carcass.getDynamicProperty('hunting:grade') ?? 'good';
  const shotId = carcass.getDynamicProperty('hunting:shot');
  const kg = weightOf(carcass, a);
  const baby = isBaby(carcass);
  const loc = carcass.location;
  const shots = shotsOf(player);
  const shot = shots.find((s) => s.id === shotId);
  const spoiled = shot?.notes?.includes('meat_damage');
  for (const l of a.loot ?? []) {
    let n = l.min + Math.floor(Math.random() * (l.max - l.min + 1));
    if (spoiled && /meat|venison|bird|fillet/.test(l.item)) n = Math.floor(n / 2);
    if (baby) n = Math.ceil(n / 3);
    if (n > 0) carcass.dimension.spawnItem(new ItemStack(l.item.includes(':') ? l.item : `minecraft:${l.item}`, n), loc);
  }
  // Trophy: males of antlered species, any adult otherwise.
  const t = a.game.trophy;
  let score = 0;
  if (t && !baby && (isMale(carcass) || TROPHY_FOR_FEMALES.has(t) || !a.game.maleTrophy)) {
    score = Math.round(a.game.score * (0.6 + 0.8 * sizeOf(carcass)) * (GRADE_FACTOR[grade] ?? 0.8) * 10) / 10;
    const trophy = new ItemStack(`hunting:${t}`, 1);
    try {
      trophy.setLore([`§6★ ${score}§r`, `§7${kg} kg`, `§7${new Date().toISOString().slice(0, 10)}`]);
    } catch {}
    carcass.dimension.spawnItem(trophy, loc);
    player.sendMessage({ rawtext: [{ translate: 'hunting.trophy.new', with: { rawtext: [nameOf(a.id), { text: String(score) }] } }] });
    player.playSound('random.levelup', { pitch: 1.2 });
  }
  recordTrophy(player, { species: a.id, kg, score, grade, shotId, day: Math.floor(world.getAbsoluteTime() / 24000) });
  player.onScreenDisplay.setActionBar({ translate: 'hunting.dress.done', with: { rawtext: [nameOf(a.id)] } });
  wearSelected(player, 1);
  try {
    carcass.dimension.playSound('mob.sheep.shear', loc);
  } catch {}
  carcass.remove();
}

export function setupWounds() {
  system.runInterval(() => tickWounded(system.currentTick), 1);
  system.runInterval(() => showTrails(system.currentTick), 40);
  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
    if (getState(target) !== STATE.carcass || !speciesOf(target)) return;
    system.run(() => fieldDress(player, target));
  });
  // Carcasses that rot away take their bleeding records with them.
  world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => bleeding.delete(removedEntityId));
}

export function isBleeding(entity) {
  return bleeding.has(entity.id);
}

export function trailsNear(dimension, location, radius) {
  return trails.filter((t) => t.dimension.id === dimension.id && Math.hypot(t.location.x - location.x, t.location.z - location.z) < radius);
}
