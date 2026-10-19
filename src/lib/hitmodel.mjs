// Builds an animal's hit model from its spec: every model cube in its rest pose plus the
// organ boxes, each with the matrix that takes model space into the box's own space.
// Bone rotations follow tools/render.mjs (and GeckoLib): applied x, then y, then z,
// with x and z the opposite of the right-hand rule in geometry space.
//
// Cube zones default from the bone name; a cube or bone can set `zone` explicitly.
import { ZONES } from '../zones.mjs';

const deg = Math.PI / 180;
const I = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) for (let k = 0; k < 4; k++) o[r * 4 + c] += a[r * 4 + k] * b[k * 4 + c];
  return o;
}
const T = ([x, y, z]) => [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1];
function Rx(t) { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1]; }
function Ry(t) { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1]; }
function Rz(t) { const c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
const R = ([x, y, z]) => mul(Rz(-z * deg), mul(Ry(y * deg), Rx(-x * deg)));
const aroundPivot = (pivot, rot) => mul(T(pivot), mul(R(rot), T(pivot.map((v) => -v))));
export const applyM = (m, [x, y, z]) => [
  m[0] * x + m[1] * y + m[2] * z + m[3],
  m[4] * x + m[5] * y + m[6] * z + m[7],
  m[8] * x + m[9] * y + m[10] * z + m[11],
];

/** Inverse of a rigid transform (rotation + translation), as a 3x4 row-major array. */
function invert(m) {
  const r = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]]; // transpose of the rotation
  const t = [m[3], m[7], m[11]];
  const ti = [
    -(r[0] * t[0] + r[1] * t[1] + r[2] * t[2]),
    -(r[3] * t[0] + r[4] * t[1] + r[5] * t[2]),
    -(r[6] * t[0] + r[7] * t[1] + r[8] * t[2]),
  ];
  return [r[0], r[1], r[2], ti[0], r[3], r[4], r[5], ti[1], r[6], r[7], r[8], ti[2]];
}

const round = (v) => Math.round(v * 10000) / 10000;

/** The zone a cube counts as when nothing more specific (an organ) is there. */
export function defaultZone(boneName) {
  const n = boneName.toLowerCase();
  if (/antler|horn|tusk/.test(n)) return 'antler';
  if (/leg|foot|paw|hoof|toe/.test(n)) return 'leg';
  if (/tail|fin|fluke/.test(n)) return 'tail';
  if (/neck/.test(n)) return 'neck';
  if (/head|ear|jaw|snout|muzzle|beak|bill|nose|wattle|snood|dewlap|bell/.test(n)) return 'jaw';
  return 'muscle';
}

/** Rest-pose bone matrices (model space) for a model spec. */
export function boneMatrices(bones) {
  const world = {};
  for (const bone of bones) {
    const parent = bone.parent ? world[bone.parent] : I();
    world[bone.name] = mul(parent, aroundPivot(bone.pivot ?? [0, 0, 0], bone.rotation ?? [0, 0, 0]));
  }
  return world;
}

/**
 * Hit model for an animal spec. `a.organs` = [{ bone, zone, origin, size }] in that bone's space.
 * Hidden-by-default bones (saddle etc.) and cubes marked `noHit` are left out.
 */
export function buildHitModel(a, { exclude = new Set() } = {}) {
  const bones = a.model.bones;
  const world = boneMatrices(bones);
  const cubes = [];
  // Excluded bones (e.g. antlers on a doe) take their children with them.
  const skip = new Set();
  for (const bone of bones) if (exclude.has(bone.name) || (bone.parent && skip.has(bone.parent))) skip.add(bone.name);
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const corners = (o, s) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [o[0] + (i & 1 ? s[0] : 0), o[1] + (i & 2 ? s[1] : 0), o[2] + (i & 4 ? s[2] : 0)]);
  for (const bone of bones) {
    if (bone.noHit || skip.has(bone.name)) continue;
    for (const cube of bone.cubes ?? []) {
      if (cube.noHit) continue;
      let m = world[bone.name];
      if (cube.rotation) m = mul(m, aroundPivot(cube.pivot ?? cube.origin.map((o, i) => o + cube.size[i] / 2), cube.rotation));
      const zone = cube.zone ?? bone.zone ?? defaultZone(bone.name);
      if (!ZONES[zone]) throw new Error(`${a.id}: unknown zone "${zone}" on bone ${bone.name}`);
      cubes.push([invert(m).map(round), cube.origin, cube.origin.map((o, i) => o + cube.size[i]), zone]);
      for (const c of corners(cube.origin, cube.size)) {
        const p = applyM(m, c);
        min = min.map((v, i) => Math.min(v, p[i]));
        max = max.map((v, i) => Math.max(v, p[i]));
      }
    }
  }
  const organs = [];
  const zoneSize = {};
  for (const o of a.organs ?? []) {
    if (!world[o.bone]) throw new Error(`${a.id}: organ ${o.zone} on unknown bone ${o.bone}`);
    if (!ZONES[o.zone]) throw new Error(`${a.id}: unknown organ zone "${o.zone}"`);
    organs.push([invert(world[o.bone]).map(round), o.origin.map(round), o.origin.map((v, i) => round(v + o.size[i])), o.zone]);
    const size = (o.size[0] + o.size[1] + o.size[2]) / 3;
    zoneSize[o.zone] = Math.max(zoneSize[o.zone] ?? 0, round(size));
  }
  // Cube zones get a typical thickness too (for the damage percentage).
  for (const [, cmin, cmax, zone] of cubes) {
    const size = Math.min(cmax[0] - cmin[0], cmax[1] - cmin[1], cmax[2] - cmin[2]);
    if (!zoneSize[zone]) zoneSize[zone] = Math.max(2, size);
  }

  const heart = (a.organs ?? []).find((o) => o.zone === 'heart');
  // Fish breathe with gills instead of lungs.
  const lungs = (a.organs ?? []).find((o) => o.zone === 'lungs') ?? (a.organs ?? []).find((o) => o.zone === 'gills');
  if (!heart || !lungs) throw new Error(`${a.id}: needs heart and lungs (or gills) organs`);
  const vital = applyM(world[heart.bone], heart.origin.map((v, i) => v + heart.size[i] / 2)).map(round);
  const vitalRadius = round(Math.max(lungs.size[1], lungs.size[2]) / 2);

  return { cubes, organs, zoneSize, vital, vitalRadius, bounds: [min.map(round), max.map(round)] };
}

/**
 * Organ boxes for a four-legged torso (deer, boar, bear, wolf...). `body` is the main
 * torso cube { origin, size } on bone `bone`, front at the low-z end.
 * Fractions run front-to-back (f), bottom-to-top (g) and are centred across (w).
 */
export function torsoOrgans(bone, body, overrides = {}) {
  const [x0, y0, z0] = body.origin;
  const [W, H, L] = body.size;
  const box = (zone, [f0, f1], [g0, g1], w, side = 0) => {
    const width = W * w;
    const cx = side === 0 ? x0 + W / 2 - width / 2 : side < 0 ? x0 : x0 + W - width;
    return { bone, zone, origin: [cx, y0 + H * g0, z0 + L * f0], size: [width, H * (g1 - g0), L * (f1 - f0)] };
  };
  const o = {
    spine: [[0, 1], [0.84, 1], 0.3],
    heart: [[0.13, 0.3], [0.08, 0.4], 0.38],
    lungs: [[0.05, 0.42], [0.25, 0.84], 0.72],
    liver: [[0.4, 0.52], [0.18, 0.72], 0.78],
    stomach: [[0.5, 0.8], [0.04, 0.74], 0.86],
    shoulder: [[0, 0.34], [0.36, 0.84], 0.22],
    ham: [[0.8, 1], [0.12, 0.84], 1],
    ...overrides,
  };
  return [
    box('spine', ...o.spine),
    box('heart', ...o.heart),
    box('lungs', ...o.lungs),
    box('liver', ...o.liver),
    box('stomach', ...o.stomach),
    box('shoulder', ...o.shoulder, -1),
    box('shoulder', ...o.shoulder, 1),
    box('ham', ...o.ham),
  ];
}

/** Neck spine: a core along the upper middle of the neck cube. */
export function neckOrgans(bone, neck) {
  const [x0, y0, z0] = neck.origin;
  const [W, H, L] = neck.size;
  return [{ bone, zone: 'spine', origin: [x0 + W * 0.33, y0, z0 + L * 0.45], size: [W * 0.34, H, L * 0.35] }];
}

/** Brain: the upper back part of the skull cube. */
export function headOrgans(bone, head, { f = [0.45, 0.9], g = [0.4, 0.85], w = 0.6 } = {}) {
  const [x0, y0, z0] = head.origin;
  const [W, H, L] = head.size;
  return [{ bone, zone: 'brain', origin: [x0 + W * (1 - w) / 2, y0 + H * g[0], z0 + L * f[0]], size: [W * w, H * (g[1] - g[0]), L * (f[1] - f[0])] }];
}

/**
 * Organ boxes for a fish. `body` is the main body cube on bone `bone` (front at the low-z
 * end), `head` the head cube on bone `headBone`. The gills sit at the back of the head, the
 * heart low just behind them, the spine runs along the upper third of the body.
 */
export function fishOrgans(bone, body, headBone, head) {
  const [x0, y0, z0] = body.origin;
  const [W, H, L] = body.size;
  const [hx, hy, hz] = head.origin;
  const [HW, HH, HL] = head.size;
  const box = (b, zone, origin, size) => ({ bone: b, zone, origin, size });
  return [
    box(headBone, 'brain', [hx + HW * 0.25, hy + HH * 0.5, hz + HL * 0.45], [HW * 0.5, HH * 0.32, HL * 0.3]),
    box(headBone, 'gills', [hx + HW * 0.08, hy + HH * 0.12, hz + HL * 0.72], [HW * 0.84, HH * 0.62, HL * 0.28]),
    box(bone, 'gills', [x0 + W * 0.1, y0 + H * 0.15, z0], [W * 0.8, H * 0.6, L * 0.06]),
    box(bone, 'heart', [x0 + W * 0.28, y0 + H * 0.08, z0 + L * 0.04], [W * 0.44, H * 0.3, L * 0.1]),
    box(bone, 'spine', [x0 + W * 0.36, y0 + H * 0.62, z0], [W * 0.28, H * 0.2, L]),
    box(bone, 'liver', [x0 + W * 0.15, y0 + H * 0.1, z0 + L * 0.14], [W * 0.7, H * 0.34, L * 0.18]),
    box(bone, 'stomach', [x0 + W * 0.2, y0 + H * 0.12, z0 + L * 0.32], [W * 0.6, H * 0.36, L * 0.26]),
  ];
}
