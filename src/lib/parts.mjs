// Helpers for building animal models from common parts.

/**
 * Four legs as bones parented to `root`, pivoting at the top.
 * x: outer edge distance from centre (legs span [x-w, x] and [-x, -x+w])
 * front/back: z of the front edge of the front and back legs.
 */
export function legs4({ x, front, back, w = 3, d = w, h = 12, foot = 2, mat = 'hide', footMat = 'hoof', parent = 'root', frontH, frontW, backW, y = 0 }) {
  const out = [];
  for (const [name, side, z, legH, legW] of [
    ['leg_fl', 1, front, frontH ?? h, frontW ?? w],
    ['leg_fr', -1, front, frontH ?? h, frontW ?? w],
    ['leg_bl', 1, back, h, backW ?? w],
    ['leg_br', -1, back, h, backW ?? w],
  ]) {
    const x0 = side > 0 ? x - legW : -x;
    const cubes = [];
    if (foot > 0) {
      cubes.push({ origin: [x0, y, z], size: [legW, foot, d], mat: footMat });
      cubes.push({ origin: [x0, y + foot, z], size: [legW, legH - foot, d], mat });
    } else {
      cubes.push({ origin: [x0, y, z], size: [legW, legH, d], mat });
    }
    out.push({ name, parent, pivot: [x0 + legW / 2, y + legH, z + d / 2], cubes });
  }
  return out;
}

/** Eye marks for a head cube `d` deep: `back` texels behind the front face, `down` from the top. */
export function eyes(d, { back = 1, down = 1, color = '#111111', w = 1, h = 1 } = {}) {
  return [
    { face: 'right', x: d - 1 - back - (w - 1), y: down, w, h, color },
    { face: 'left', x: back, y: down, w, h, color },
  ];
}

/**
 * Forward-facing eyes on the front face of a head `w` wide (cats, primates).
 * With `pupil`, each eye is two texels: `color` on the outside, `pupil` inside.
 */
export function frontEyes(w, { gap = 2, down = 1, color = '#111111', pupil } = {}) {
  const size = pupil ? 2 : 1;
  const left = Math.floor((w - gap) / 2) - size;
  const right = Math.ceil((w + gap) / 2);
  const marks = [
    { face: 'front', x: left, y: down, w: size, color },
    { face: 'front', x: right, y: down, w: size, color },
  ];
  if (pupil) {
    marks.push({ face: 'front', x: left + 1, y: down, color: pupil });
    marks.push({ face: 'front', x: right, y: down, color: pupil });
  }
  return marks;
}

/** Two nostrils/dots on the front face. */
export function nostrils(w, { down = 0, gap = 2, color = '#1a1a1a' } = {}) {
  const l = Math.floor((w - gap) / 2) - 1;
  return [
    { face: 'front', x: l, y: down, color },
    { face: 'front', x: w - 1 - l, y: down, color },
  ];
}

// Texture region predicates
export const bone = (...names) => ({ cube }) => names.includes(cube.bone);
export const notBone = (...names) => ({ cube }) => !names.includes(cube.bone);
export const face = (...names) => ({ face: f }) => names.includes(f);
export const notFace = (...names) => ({ face: f }) => !names.includes(f);
export const all = (...preds) => (ctx) => preds.every((p) => p(ctx));
export const below = (y) => ({ p }) => p[1] < y;
export const LEGS = ['leg_fl', 'leg_fr', 'leg_bl', 'leg_br'];
