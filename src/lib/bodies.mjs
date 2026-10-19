// Parametric body plans shared by several species. Each returns { bones, organs }:
// the model bones and the organ boxes for the hit zones (see src/lib/hitmodel.mjs).
import { eyes, legs4, nostrils } from './parts.mjs';
import { fishOrgans, headOrgans, neckOrgans, torsoOrgans } from './hitmodel.mjs';

/**
 * Deer family (white-tailed deer, red deer, roe deer, moose). Sizes in pixels.
 * Bones: root, body, neck, head, antlers (bucks/bulls only), ear_l, ear_r, tail, legs.
 * Materials: hide, belly, face, muzzle, nose, ear, tail, hoof, antler, (bell for moose).
 * antlers: a function (headTop, headZ) => cubes, or null.
 * Returns { bones, organs, at } where `at` holds key coordinates for species-specific extras.
 */
export function cervid({
  bodyW = 6, bodyH = 7, bodyL = 18, legH = 12, legW = 2, hump = 0,
  neckW = 3, neckH = 9, neckD = 4, neckTilt = 35,
  headW = 4, headH = 4, headD = 5, muzzleW = 3, muzzleH = 3, muzzleD = 4, muzzleDrop = 1,
  earW = 2, earH = 3, tailL = 3, tailW = 2, bell = false, bellW = 2, bellH = 4, antlers = null,
} = {}) {
  const bottom = legH;
  const top = bottom + bodyH;
  const zf = -bodyL / 2, zb = bodyL / 2;
  const body = { origin: [-bodyW / 2, bottom, zf], size: [bodyW, bodyH, bodyL], mat: 'hide' };
  // Neck rises from the front top of the body, tilted forward.
  const neckBase = [0, top - 2, zf + 2];
  const neck = { origin: [-neckW / 2, top - 3, zf - 1], size: [neckW, neckH, neckD], mat: 'hide' };
  const neckTop = top - 3 + neckH;
  // The skull sits on top of the neck (its back edge over the neck's back), muzzle forward.
  const hz = zf - 1 + neckD; // head back edge
  const head = { origin: [-headW / 2, neckTop - 2, hz - headD], size: [headW, headH, headD], mat: 'face', marks: eyes(headD, { back: 1, down: 1 }) };
  const muzzle = {
    origin: [-muzzleW / 2, neckTop - 2 - muzzleDrop, hz - headD - muzzleD],
    size: [muzzleW, muzzleH, muzzleD], mat: 'muzzle',
    marks: [{ face: 'front', x: 0, y: 0, w: muzzleW, h: 1, color: '#1a1414' }],
  };
  const bones = [
    { name: 'root', pivot: [0, 0, 0] },
    {
      name: 'body', parent: 'root', pivot: [0, bottom + bodyH / 2, 0],
      cubes: [
        body,
        ...(hump ? [{ origin: [-bodyW / 2 + 1, top, zf + 1], size: [bodyW - 2, hump, Math.round(bodyL / 3)], mat: 'hide', zone: 'muscle' }] : []),
      ],
    },
    { name: 'tail', parent: 'body', pivot: [0, top - 1, zb], rotation: [25, 0, 0], cubes: [{ origin: [-tailW / 2, top - 1 - tailL, zb], size: [tailW, tailL, 1], mat: 'tail' }] },
    {
      name: 'neck', parent: 'body', pivot: neckBase, rotation: [neckTilt, 0, 0],
      cubes: [neck],
    },
    // The dewlap ("bell") hangs straight down from the throat just behind the jaw.
    ...(bell ? [{
      name: 'bell', parent: 'neck', pivot: [0, neckTop - 3, zf - 1], rotation: [-neckTilt, 0, 0],
      cubes: [{ origin: [-bellW / 2, neckTop - 3 - bellH, zf - 1.5], size: [bellW, bellH, 2], mat: 'bell', zone: 'neck' }],
    }] : []),
    { name: 'head', parent: 'neck', pivot: [0, neckTop - 1, zf + 1], rotation: [-neckTilt + 10, 0, 0], cubes: [head, muzzle] },
    { name: 'ear_l', parent: 'head', pivot: [headW / 2, neckTop + headH - 3, hz - 2], rotation: [0, 0, -30], cubes: [{ origin: [headW / 2, neckTop + headH - 3, hz - 2], size: [earW, earH, 1], mat: 'ear' }] },
    { name: 'ear_r', parent: 'head', pivot: [-headW / 2, neckTop + headH - 3, hz - 2], rotation: [0, 0, 30], cubes: [{ origin: [-headW / 2 - earW, neckTop + headH - 3, hz - 2], size: [earW, earH, 1], mat: 'ear' }] },
  ];
  if (antlers) {
    bones.push({ name: 'antlers', parent: 'head', pivot: [0, neckTop - 2 + headH, hz - 2], cubes: antlers(neckTop - 2 + headH, hz - 2) });
  }
  bones.push(...legs4({ x: bodyW / 2, front: zf + 1, back: zb - 1 - legW, w: legW, h: legH + 1, foot: 1, mat: 'hide', footMat: 'hoof' }));

  const organs = [
    ...torsoOrgans('body', body),
    ...neckOrgans('neck', neck),
    ...headOrgans('head', head),
  ];
  // `at`: key coordinates so species can add their own parts (manes, noses...).
  const at = { bottom, top, zf, zb, neckTop, hz, headTop: neckTop - 2 + headH, neck, head, muzzle };
  return { bones, organs, at };
}

/** A tine: a thin 1x1 rod `len` long, leaning by `rot` around its base. */
export const tine = (base, len, rot, mat = 'antler') => ({
  origin: [base[0], base[1], base[2]], size: [1, len, 1], mat, rotation: rot, pivot: [base[0] + 0.5, base[1], base[2] + 0.5],
});

/**
 * Fish (sea bass, tuna, shark). The body is a box with a tapering tail section behind it,
 * a forked caudal fin, a dorsal fin and two pectoral fins; the head (with an optional jaw)
 * sits in front. Sizes in pixels; `lift` raises the whole fish off the bottom of its box.
 * Bones: root, body, head, jaw (optional), tail, caudal_fin, dorsal_fin, fin_l, fin_r.
 * Materials: scales, belly, head, fin, eye (marks), jaw/teeth when `teeth`.
 */
export function fishBody({
  bodyW = 4, bodyH = 5, bodyL = 10, headW = 3, headH = 4, headL = 4, jaw = false, teeth = false,
  tailW = 2, tailH = 3, tailL = 5, caudalH = 7, caudalL = 3, dorsalH = 3, dorsalL = 4, dorsal2 = 0,
  pectoral = 3, lift = 1,
} = {}) {
  const bottom = lift;
  const top = bottom + bodyH;
  const cy = bottom + bodyH / 2;
  const zf = -bodyL / 2, zb = bodyL / 2;
  const body = { origin: [-bodyW / 2, bottom, zf], size: [bodyW, bodyH, bodyL], mat: 'scales' };
  const hy = Math.round(cy - headH / 2);
  const head = {
    origin: [-headW / 2, hy + (jaw ? 1 : 0), zf - headL], size: [headW, headH - (jaw ? 1 : 0), headL], mat: 'head',
    marks: eyes(headL, { back: 1, down: 1 }),
  };
  const ty = Math.round(cy - tailH / 2);
  const bones = [
    { name: 'root', pivot: [0, cy, 0] },
    { name: 'body', parent: 'root', pivot: [0, cy, 0], cubes: [body] },
    { name: 'head', parent: 'body', pivot: [0, cy, zf], cubes: [head] },
    ...(jaw ? [{
      name: 'jaw', parent: 'head', pivot: [0, hy + 1, zf],
      cubes: [{ origin: [-(headW - 1) / 2, hy, zf - headL + 1], size: [headW - 1, 1, headL - 1], mat: teeth ? 'teeth' : 'head' }],
    }] : []),
    { name: 'tail', parent: 'body', pivot: [0, cy, zb], cubes: [{ origin: [-tailW / 2, ty, zb], size: [tailW, tailH, tailL], mat: 'scales' }] },
    {
      name: 'caudal_fin', parent: 'tail', pivot: [0, cy, zb + tailL],
      cubes: [
        { origin: [-0.5, Math.round(cy), zb + tailL - 1], size: [1, Math.ceil(caudalH / 2), caudalL], mat: 'fin', rotation: [-30, 0, 0], pivot: [0, cy, zb + tailL - 1] },
        { origin: [-0.5, Math.round(cy) - Math.ceil(caudalH / 2), zb + tailL - 1], size: [1, Math.ceil(caudalH / 2), caudalL], mat: 'fin', rotation: [30, 0, 0], pivot: [0, cy, zb + tailL - 1] },
      ],
    },
    {
      name: 'dorsal_fin', parent: 'body', pivot: [0, top, zf + 2],
      cubes: [
        { origin: [-0.5, top, Math.round(zf + bodyL * 0.25)], size: [1, dorsalH, dorsalL], mat: 'fin', rotation: [-20, 0, 0], pivot: [0, top, Math.round(zf + bodyL * 0.25)] },
        ...(dorsal2 ? [{ origin: [-0.5, top, Math.round(zf + bodyL * 0.7)], size: [1, dorsal2, 2], mat: 'fin' }] : []),
      ],
    },
    { name: 'fin_l', parent: 'body', pivot: [bodyW / 2, bottom + 1, zf + 1], rotation: [0, 0, -40], cubes: [{ origin: [bodyW / 2, bottom + 1, zf + 1], size: [pectoral, 1, Math.max(2, pectoral - 1)], mat: 'fin', noHit: true }] },
    { name: 'fin_r', parent: 'body', pivot: [-bodyW / 2, bottom + 1, zf + 1], rotation: [0, 0, 40], cubes: [{ origin: [-bodyW / 2 - pectoral, bottom + 1, zf + 1], size: [pectoral, 1, Math.max(2, pectoral - 1)], mat: 'fin', noHit: true }] },
  ];
  const organs = fishOrgans('body', body, 'head', head);
  const at = { bottom, top, cy, zf, zb, body, head };
  return { bones, organs, at };
}
