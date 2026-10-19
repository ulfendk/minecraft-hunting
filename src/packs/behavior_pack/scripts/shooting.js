// Rifles, the shotgun, the compound bow, and what a harpoon does when it hits.
//
// Rifles: use (right-click / tap) raises the scope; use again fires. Tap sneak to change the
// zoom, hold sneak to steady your aim and hold your breath (not for too long). Jump or switch
// items to lower the scope. The bullet follows a real trajectory (drop, wind drift) and is
// traced against blocks and against the animals' actual model shapes; game animals get a
// full hit-zone evaluation and shot report. Firearms don't work under water.
import { system, world } from '@minecraft/server';
import { CALIBRES, FIREARMS, ZONE_PRIORITY, ZONES } from './data.js';
import { energyAt, pointAt } from './lib/ballistics.js';
import { evaluate, intersect, toModel } from './lib/hitzones.js';
import { getState, hitModelOf, scaleOf, scopeCode, setScopeHud, speciesOf, STATE, tickHud, wind } from './game.js';
import { recordShot } from './report.js';
import { gunshot, makeNoise } from './senses.js';
import { applyHit } from './wounds.js';
import { consumeOne, dist, eyeInWater, findItem, heldItem, isCreative, norm, sub, wearSelected } from './util.js';
import { harpoonStruck, POWER } from './harpoon.js';

const FIREARM_IDS = Object.keys(FIREARMS);
const scoped = new Map(); // player id -> { id, zoom, breath, shaky, sneakAt, sway: {x, y} }
const cycleUntil = new Map(); // player id -> tick

const firearmOf = (item) => (item?.typeId?.startsWith('hunting:') ? FIREARMS[item.typeId.slice(8)] && item.typeId.slice(8) : undefined);

// ---------------------------------------------------------------- scope

function raiseScope(player, id) {
  const s = { id, zoom: 0, breath: 100, holding: false, shaky: 0, sneakAt: -1, sway: { x: 0, y: 0 }, t: Math.random() * 1000 };
  scoped.set(player.id, s);
  setZoom(player, s);
  player.playSound('item.spyglass.use');
}

function setZoom(player, s) {
  const f = FIREARMS[s.id];
  try {
    player.runCommand(`camera @s fov_set ${f.zoom[s.zoom]} 0.15`);
  } catch {}
  setScopeHud(player, scopeCode(FIREARM_IDS.indexOf(s.id), s.zoom));
}

export function lowerScope(player) {
  if (!scoped.has(player.id)) return;
  scoped.delete(player.id);
  try {
    player.runCommand('camera @s fov_clear 0.15');
  } catch {}
  setScopeHud(player, undefined);
  try { player.playSound('item.spyglass.stop_using'); } catch {}
}

export const isScoped = (player) => scoped.has(player.id);

/** Smooth 1-D noise for the sway. */
const wobble = (t, seed) => Math.sin(t * 0.9 + seed) * 0.6 + Math.sin(t * 2.3 + seed * 1.7) * 0.3 + Math.sin(t * 5.1 + seed * 0.3) * 0.1;

function tickScope(player, now) {
  const s = scoped.get(player.id);
  if (!s) return;
  const held = heldItem(player);
  if (firearmOf(held) !== s.id) {
    lowerScope(player);
    return;
  }
  // Sneak: tap = next zoom level, hold = hold your breath.
  if (player.isSneaking) {
    if (s.sneakAt < 0) s.sneakAt = now;
    if (now - s.sneakAt > 6 && s.shaky <= 0) {
      s.holding = true;
      s.breath -= 1;
      if (s.breath <= 0) {
        s.holding = false;
        s.shaky = 60;
      }
    }
  } else {
    if (s.sneakAt >= 0 && now - s.sneakAt <= 6) {
      s.zoom = (s.zoom + 1) % FIREARMS[s.id].zoom.length;
      setZoom(player, s);
      player.playSound('random.click', { pitch: 1.8, volume: 0.4 });
    }
    s.sneakAt = -1;
    s.holding = false;
    s.breath = Math.min(100, s.breath + 0.8);
  }
  if (s.shaky > 0) s.shaky--;

  // Sway: degrees. Standing ~0.15, crouched less, holding breath almost none, out of breath a lot.
  let amp = 0.15 * FIREARMS[s.id].sway;
  if (player.isSneaking) amp *= 0.45;
  if (s.holding) amp *= 0.12;
  if (s.shaky > 0) amp *= 2.5;
  const v = player.getVelocity();
  if (Math.hypot(v.x, v.z) > 0.05) amp *= 3;
  s.t += 0.05;
  const target = { x: wobble(s.t, 1.3) * amp, y: wobble(s.t, 7.9) * amp };
  try {
    const r = player.getRotation();
    player.setRotation({ x: r.x + (target.x - s.sway.x), y: r.y + (target.y - s.sway.y) });
  } catch {}
  s.sway = target;

  if (now % 4 === 0) scopeInfo(player, s);
}

/** Range finder, zoom and wind on the action bar while looking through the scope. */
function scopeInfo(player, s) {
  const f = FIREARMS[s.id];
  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  let range = '—';
  try {
    const e = player.getEntitiesFromViewDirection({ maxDistance: 320 })[0];
    const b = player.dimension.getBlockFromRay(eye, dir, { maxDistance: 320, includeLiquidBlocks: true, includePassableBlocks: false });
    const db = b ? dist(eye, { x: b.block.location.x + b.faceLocation.x, y: b.block.location.y + b.faceLocation.y, z: b.block.location.z + b.faceLocation.z }) : Infinity;
    const d = Math.min(e?.distance ?? Infinity, db);
    if (d !== Infinity) range = String(Math.round(d));
  } catch {}
  const w = wind();
  const mag = Math.round(70 / f.zoom[s.zoom]);
  const parts = [
    { translate: 'hunting.hud.scope', with: { rawtext: [{ text: String(mag) }, { text: range }, { translate: 'hunting.wind.short', with: { rawtext: [{ translate: `hunting.wind.arrow.${compassOf(w.from)}` }, { text: w.speed.toFixed(1) }] } }] } },
  ];
  if (s.holding) parts.push({ text: '  ' }, { translate: 'hunting.hud.steady' });
  if (s.shaky > 0) parts.push({ text: '  ' }, { translate: 'hunting.hud.shaky' });
  player.onScreenDisplay.setActionBar({ rawtext: parts });
}

const compassOf = (deg) => ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'][Math.round((((deg % 360) + 360) % 360) / 45) % 8];

// ---------------------------------------------------------------- firing

/** Trace one projectile path. Returns { kind: 'game'|'entity'|'block'|'none', ... }. */
export function trace(dimension, eye, dir, calibre, w, shooter) {
  const c = calibre;
  // Where the path meets a block (in 8 m chords along the curve).
  let blockS = c.range;
  for (let s0 = 0; s0 < c.range; s0 += 8) {
    const p0 = pointAt(c, eye, dir, w, s0);
    const p1 = pointAt(c, eye, dir, w, Math.min(c.range, s0 + 8));
    const seg = sub(p1, p0);
    const len = Math.hypot(seg.x, seg.y, seg.z);
    let hit;
    try {
      hit = dimension.getBlockFromRay(p0, norm(seg), { maxDistance: len, includeLiquidBlocks: true, includePassableBlocks: false });
    } catch {
      blockS = s0; // unloaded chunk: the shot goes nowhere we can follow
      break;
    }
    if (hit) {
      const at = { x: hit.block.location.x + hit.faceLocation.x, y: hit.block.location.y + hit.faceLocation.y, z: hit.block.location.z + hit.faceLocation.z };
      blockS = s0 + dist(p0, at);
      break;
    }
  }

  // Game animals near the line, nearest first, tested against their model shapes.
  let candidates = [];
  try {
    candidates = dimension.getEntities({ families: ['hunting_game'], location: eye, maxDistance: Math.min(blockS, c.range) + 4 });
  } catch {}
  const near = [];
  for (const e of candidates) {
    const a = speciesOf(e);
    if (!a || getState(e) === STATE.carcass) continue;
    const mid = { x: e.location.x, y: e.location.y + 0.6, z: e.location.z };
    const v = sub(mid, eye);
    const s = v.x * dir.x + v.y * dir.y + v.z * dir.z;
    if (s < 0 || s > blockS + 3) continue;
    const off = Math.hypot(v.x - dir.x * s, v.y - dir.y * s, v.z - dir.z * s);
    if (off < 4 + (a.scale ?? 1) * 2) near.push({ e, a, s });
  }
  near.sort((p, q) => p.s - q.s);
  for (const { e, a, s } of near) {
    const back = Math.max(0, s - 5);
    const p0 = pointAt(c, eye, dir, w, back);
    const p1 = pointAt(c, eye, dir, w, s + 5);
    const k = scaleOf(e, a);
    let yaw = 0;
    try { yaw = e.getRotation().y; } catch {}
    const m = toModel(e.location, yaw, k);
    const o = m.point(p0);
    const d = m.dir(sub(p1, p0));
    // Distance where the bullet reaches the body, for the energy at impact.
    const model = hitModelOf(e, a);
    const span = quickEntry(model, o, d);
    if (span === null) continue;
    const distance = back + (span * k) / 16;
    if (distance > blockS) continue;
    const energy = energyAt(c, distance);
    const penetration = c.penetration * Math.sqrt(energy / c.energy);
    const report = evaluate({
      model, zones: ZONES, priority: ZONE_PRIORITY, o, d, energy, penetration, cmPerPx: 6.25 * k,
      minEnergy: c.pellets ? a.game.minShotEnergy ?? 4 : c.projectile ? 0 : a.game.minEnergy,
      bigGame: a.game.class !== 'small',
    });
    if (report.hit) return { kind: 'game', entity: e, a, distance, energy, report };
  }

  // Anything else in the way (vanilla mobs, players).
  try {
    const hits = dimension.getEntitiesFromRay(eye, dir, { maxDistance: blockS, excludeFamilies: ['hunting_game', 'inanimate', 'hunting_scare'] });
    const h = hits.find((x) => x.entity.id !== shooter?.id);
    if (h) return { kind: 'entity', entity: h.entity, distance: h.distance, energy: energyAt(c, h.distance) };
  } catch {}
  return blockS < c.range ? { kind: 'block', distance: blockS } : { kind: 'none' };
}

function quickEntry(model, o, d) {
  const span = intersect(model, o, d);
  return span ? span[0] : null;
}

function spread(dir, degrees) {
  const r = (degrees * Math.PI) / 180;
  const a = Math.random() * Math.PI * 2, m = Math.sqrt(Math.random()) * r;
  // Any two vectors perpendicular to dir.
  const up = Math.abs(dir.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const u = norm({ x: dir.y * up.z - dir.z * up.y, y: dir.z * up.x - dir.x * up.z, z: dir.x * up.y - dir.y * up.x });
  const v = { x: dir.y * u.z - dir.z * u.y, y: dir.z * u.x - dir.x * u.z, z: dir.x * u.y - dir.y * u.x };
  return norm({
    x: dir.x + (u.x * Math.cos(a) + v.x * Math.sin(a)) * m,
    y: dir.y + (u.y * Math.cos(a) + v.y * Math.sin(a)) * m,
    z: dir.z + (u.z * Math.cos(a) + v.z * Math.sin(a)) * m,
  });
}

function merge(reports) {
  // Shotgun: one report per animal, pellets combined.
  const zones = new Map();
  let best = reports[0];
  const rank = { kill: 3, mortal: 2, wound: 1, none: 0 };
  const gradeRank = { perfect: 0, good: 1, poor: 2, unethical: 3, miss: 4 };
  for (const r of reports) {
    for (const z of r.zones) zones.set(z.zone, Math.min(100, (zones.get(z.zone) ?? 0) + z.percent));
    if (rank[r.fate] > rank[best.fate] || (rank[r.fate] === rank[best.fate] && gradeRank[r.grade] < gradeRank[best.grade])) best = r;
  }
  const accuracy = Math.max(...reports.map((r) => r.accuracy));
  // A bird or hare downed by several pellets dies at once.
  const fate = best.fate === 'mortal' && reports.length >= 3 ? 'kill' : best.fate;
  return { ...best, fate, accuracy, zones: [...zones.entries()].map(([zone, percent]) => ({ zone, percent })) };
}

export function fire(player, id) {
  const now = system.currentTick;
  const f = FIREARMS[id];
  const c = { ...CALIBRES[f.calibre], id: f.calibre };
  if ((cycleUntil.get(player.id) ?? 0) > now) {
    player.onScreenDisplay.setActionBar({ translate: 'hunting.hud.cycling' });
    return;
  }
  // Under water a firearm is useless: the powder is wet and the bullet stops in a metre.
  if (eyeInWater(player)) {
    player.onScreenDisplay.setActionBar({ translate: 'hunting.hud.underwater_gun' });
    player.playSound('random.click', { pitch: 0.5 });
    lowerScope(player);
    return;
  }
  if (!isCreative(player)) {
    const ammo = findItem(player, `hunting:${f.ammo}`);
    if (!ammo) {
      player.onScreenDisplay.setActionBar({ translate: 'hunting.hud.no_ammo', with: { rawtext: [{ translate: `item.hunting:${f.ammo}.name` }] } });
      player.playSound('random.click', { pitch: 0.6 });
      return;
    }
    consumeOne(ammo);
  }
  cycleUntil.set(player.id, now + f.cycle);
  wearSelected(player, 1);

  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  const w = wind();
  const dim = player.dimension;
  try {
    dim.playSound('firework.blast', eye, { pitch: c.pellets ? 0.7 : 0.5, volume: 6 });
    dim.playSound('random.explode', eye, { pitch: c.pellets ? 1.3 : 1.7, volume: 1.2 });
  } catch {}
  system.runTimeout(() => {
    try { player.playSound('crossbow.loading.end', { pitch: c.pellets ? 0.8 : 1.4 }); } catch {}
  }, Math.round(f.cycle * 0.6));
  gunshot(player, c.pellets ? 0.8 : 1);

  const pellets = c.pellets ?? 1;
  const perAnimal = new Map(); // entity id -> { hit, reports: [] }
  for (let i = 0; i < pellets; i++) {
    const d = pellets > 1 ? spread(dir, c.spread) : dir;
    const hit = trace(dim, eye, d, c, w, player);
    impactEffects(dim, eye, d, c, w, hit);
    if (hit.kind === 'game') {
      const rec = perAnimal.get(hit.entity.id) ?? { hit, reports: [] };
      rec.reports.push(hit.report);
      perAnimal.set(hit.entity.id, rec);
    } else if (hit.kind === 'entity') {
      try {
        const dmg = c.pellets ? 2 : Math.min(40, hit.energy / 150);
        hit.entity.applyDamage(dmg, { cause: 'projectile', damagingEntity: player });
      } catch {}
    }
  }
  for (const { hit, reports } of perAnimal.values()) {
    const report = pellets > 1 ? merge(reports) : reports[0];
    const record = recordShot(player, {
      species: hit.a.id, distance: hit.distance, calibre: c.name, energy: hit.energy, pellets, pelletsHit: reports.length, ...report,
    });
    applyHit(hit.entity, hit.a, report, player, record.id);
  }
}

/** Dust where the bullet strikes a block. */
function impactEffects(dim, eye, dir, c, w, hit) {
  if (hit.kind !== 'block') return;
  try {
    const p = pointAt(c, eye, dir, w, hit.distance);
    dim.spawnParticle('minecraft:basic_smoke_particle', p);
  } catch {}
}

// ---------------------------------------------------------------- bow and harpoons

/** The calibre each of our projectiles is evaluated as. */
const PROJECTILE_CALIBRE = { 'hunting:broadhead_arrow': 'arrow', 'hunting:harpoon_bolt': 'harpoon_bolt', 'hunting:thrown_harpoon': 'thrown_harpoon' };

function projectileHit(event) {
  const { projectile, source, location, hitVector } = event;
  let typeId;
  try { typeId = projectile.typeId; } catch { return; }
  const calibre = PROJECTILE_CALIBRE[typeId];
  if (!calibre) return;
  const harpoon = typeId !== 'hunting:broadhead_arrow';
  // A harpoon fired or thrown through the air is slow and weak (scripts/harpoon.js sets this).
  let power = 1;
  try { power = projectile.getDynamicProperty(POWER) ?? 1; } catch {}
  const target = event.getEntityHit()?.entity;
  if (!target || target.typeId === 'hunting:mini_submarine') return;
  const a = speciesOf(target);
  if (!a || !source || source.typeId !== 'minecraft:player') {
    // Vanilla fish and squid: a plain hit.
    if (harpoon && target && source) {
      try { target.applyDamage(Math.round(6 * power * power), { cause: 'projectile', damagingEntity: source }); } catch {}
      harpoonStruck(projectile, target, source, null);
    }
    return;
  }
  if (getState(target) === STATE.carcass) {
    // Spearing a carcass (a dead fish floating off) lets you reel it in.
    if (harpoon) harpoonStruck(projectile, target, source, null);
    return;
  }
  const c = { ...CALIBRES[calibre], id: calibre };
  const dir = norm(hitVector);
  const k = scaleOf(target, a);
  let yaw = 0;
  try { yaw = target.getRotation().y; } catch {}
  const m = toModel(target.location, yaw, k);
  const start = { x: location.x - dir.x * 3, y: location.y - dir.y * 3, z: location.z - dir.z * 3 };
  const o = m.point(start), d = m.dir(dir);
  const energy = c.energy * power * power;
  let report = evaluate({ model: hitModelOf(target, a), zones: ZONES, priority: ZONE_PRIORITY, o, d, energy, penetration: c.penetration * power, cmPerPx: 6.25 * k, minEnergy: 0, bigGame: true });
  // The engine says it hit; our model says it slipped past: count it as a graze.
  if (!report.hit) report = { ...report, hit: true, zones: [{ zone: 'muscle', percent: 10 }], fate: 'wound', grade: 'unethical' };
  const distance = dist(source.location, location);
  const record = recordShot(source, { species: a.id, distance, calibre: c.name, energy, ...report });
  applyHit(target, a, report, source, record.id);
  makeNoise(source, harpoon ? 6 : 10);
  if (harpoon) harpoonStruck(projectile, target, source, report);
}

// ---------------------------------------------------------------- setup

export function setupShooting() {
  world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    const id = firearmOf(itemStack);
    if (!id || source.typeId !== 'minecraft:player') return;
    const f = FIREARMS[id];
    if (!f.zoom) {
      system.run(() => fire(source, id));
      return;
    }
    const s = scoped.get(source.id);
    if (!s || s.id !== id) system.run(() => raiseScope(source, id));
    else system.run(() => fire(source, id));
  });
  world.afterEvents.playerButtonInput.subscribe(({ player, button, newButtonState }) => {
    if (button === 'Jump' && newButtonState === 'Pressed') lowerScope(player);
  });
  world.afterEvents.projectileHitEntity.subscribe(projectileHit);
  world.afterEvents.playerLeave.subscribe(({ playerId }) => scoped.delete(playerId));
  system.runInterval(() => {
    const now = system.currentTick;
    for (const player of world.getPlayers()) {
      tickScope(player, now);
      tickHud(player, now);
    }
  }, 1);
}
