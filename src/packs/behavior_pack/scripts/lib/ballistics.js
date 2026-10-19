// Exterior ballistics and wind. Plain JavaScript with no game imports, so the build
// tools and tests can use it too. The Java mod has the same formulas in
// dk.ulfen.hunting.hunt.Ballistics and dk.ulfen.hunting.hunt.Wind.
//
// Distances are in blocks (= metres). Velocity decays exponentially with distance:
//   v(s) = v0 * exp(-k s)        energy E(s) = E0 * exp(-2 k s)
//   time of flight t(s) = (exp(k s) - 1) / (k v0)
//   drop below the bore line d(s) = g t(s)^2 / 2
//   wind drift = crosswind * (t(s) - s / v0)          (the "lag time" rule)

export const GRAVITY = 9.81;
/** Scope height above the bore, in metres. */
export const SIGHT_HEIGHT = 0.04;
/** Every scope is zeroed at this distance. */
export const ZERO = 100;

export function timeOfFlight(c, s) {
  return c.drag > 0 ? (Math.exp(c.drag * s) - 1) / (c.drag * c.velocity) : s / c.velocity;
}

export const velocityAt = (c, s) => c.velocity * Math.exp(-c.drag * s);
export const energyAt = (c, s) => c.energy * Math.exp(-2 * c.drag * s);
export const dropAt = (c, s) => 0.5 * GRAVITY * timeOfFlight(c, s) ** 2;

/** Bore angle (radians, small) that puts the bullet on the line of sight at the zero distance. */
export function zeroAngle(c) {
  return (dropAt(c, ZERO) + SIGHT_HEIGHT) / ZERO;
}

/** Height of the bullet relative to the line of sight at distance s (metres, negative = low). */
export function heightAt(c, s) {
  return -SIGHT_HEIGHT + zeroAngle(c) * s - dropAt(c, s);
}

/** Sideways drift for a crosswind of `wind` m/s at distance s. */
export function driftAt(c, s, wind) {
  return wind * (timeOfFlight(c, s) - s / c.velocity);
}

/**
 * Bullet position at distance s along the aim, for an eye position, unit aim direction and
 * a horizontal wind vector (m/s, the direction the wind blows towards).
 */
export function pointAt(c, eye, dir, wind, s) {
  const h = Math.hypot(dir.x, dir.z) || 1;
  const hx = dir.x / h, hz = dir.z / h;
  const along = wind.x * hx + wind.z * hz;
  const cx = wind.x - along * hx, cz = wind.z - along * hz; // crosswind part
  const lag = timeOfFlight(c, s) - s / c.velocity;
  const y = heightAt(c, s);
  return {
    x: eye.x + dir.x * s + cx * lag,
    y: eye.y + dir.y * s + y,
    z: eye.z + dir.z * s + cz * lag,
  };
}

/**
 * Holdover table for the reticle: how many centimetres high to aim at each distance.
 */
export function holdover(c, distances = [50, 100, 150, 200, 250, 300]) {
  return distances.map((s) => ({ s, cm: Math.round(-heightAt(c, s) * 1000) / 10 }));
}

// ---------------------------------------------------------------- wind

/** Beaufort-ish names for wind speeds in m/s. */
export function windStrength(speed) {
  if (speed < 0.5) return 0;
  if (speed < 2) return 1;
  if (speed < 4) return 2;
  if (speed < 6) return 3;
  if (speed < 8.5) return 4;
  return 5;
}

/**
 * Wind at a world time (ticks). Slowly turning, gusting a little. Deterministic so both
 * editions agree. Returns { x, z } (m/s, direction the wind blows towards), speed and the
 * compass direction it blows *from* in degrees (0 = from the north, 90 = from the east).
 */
export function windAt(ticks) {
  const t = ticks;
  const angle = 0.8 + 1.4 * Math.sin(t / 9000) + 0.6 * Math.sin(t / 2300 + 1.3) + 0.25 * Math.sin(t / 410 + 0.4);
  let speed = 3.2 + 2.4 * Math.sin(t / 6100 + 0.4) + 1.1 * Math.sin(t / 1300 + 2.1) + 0.5 * Math.sin(t / 170);
  speed = Math.max(0, Math.min(10, speed));
  const x = Math.cos(angle) * speed;
  const z = Math.sin(angle) * speed;
  // Blowing towards (x, z) means it comes from (-x, -z). North is -z, east is +x.
  let from = (Math.atan2(-x, z) * 180) / Math.PI; // 0 when blowing towards +z (from the north)
  from = ((from % 360) + 360) % 360;
  return { x, z, speed, from };
}

/** Eight compass points for a "from" bearing. */
export function compass(deg) {
  return ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'][Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}
