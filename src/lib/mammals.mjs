// Body plans for the non-deer mammals: boar (suid), bear (ursid), wolf and fox (canid)
// and hare (leporid). Each returns { bones, organs } like cervid() in bodies.mjs.
// Sizes in pixels; the animal faces -z, +x is its left.
//
// Bones: root, body, head, (tusks), ear_l, ear_r, tail, leg_fl/leg_fr/leg_bl/leg_br.
// Materials: hide, leg, paw, face, muzzle, ear, tail, plus per plan (bristle, tusk, snout, ruff...).
import { eyes, legs4, nostrils } from './parts.mjs';
import { headOrgans, torsoOrgans } from './hitmodel.mjs';

/**
 * Generic four-legged mammal with the head carried in front of the body (no separate neck).
 *   body: [W, H, L]; legH, legW, legD, legInset (from the body side), frontInset/backInset (from the ends)
 *   head: { size: [W, H, D], y (bottom), z (back face), pitch, eye: { back, down } }
 *   muzzle: { size: [W, H, D], dy (above head bottom), mat, nose }
 *   ears: { size: [W, H, D], x (inner edge from centre), z (from the head's back face), splay, tilt }
 *   tail: { size: [W, len, D], y (below body top), rot, inset } hanging from the rump, or `cubes(ty, zb)`
 *   bodyExtras(ctx) / headExtras(ctx) => cubes; headBones(ctx) => extra bones parented to head.
 *   organs: torsoOrgans overrides.
 */
export function mammal(o) {
  const [W, H, L] = o.body;
  const legH = o.legH, legW = o.legW ?? 2, legD = o.legD ?? legW;
  const bottom = legH, top = bottom + H, zf = -L / 2, zb = L / 2;
  const body = { origin: [-W / 2, bottom, zf], size: [W, H, L], mat: 'hide' };
  const ctx = { W, H, L, bottom, top, zf, zb };

  const bones = [
    { name: 'root', pivot: [0, 0, 0] },
    { name: 'body', parent: 'root', pivot: [0, bottom + H / 2, 0], cubes: [body, ...(o.bodyExtras?.(ctx) ?? [])] },
  ];

  if (o.tail) {
    const t = o.tail;
    const ty = top - (t.y ?? 1), tz = zb - (t.inset ?? 0);
    const [tw, len, td] = t.size ?? [1, 4, 1];
    const cubes = t.cubes ? t.cubes(ty, tz) : [{ origin: [-tw / 2, ty - len, tz], size: [tw, len, td], mat: 'tail' }];
    bones.push({ name: 'tail', parent: 'body', pivot: [0, ty, tz + (t.cubes ? 0 : td / 2)], rotation: [t.rot ?? 20, 0, 0], cubes });
  }

  const h = o.head;
  const [hw, hh, hd] = h.size;
  const hz = h.z, hy = h.y, htop = hy + hh;
  const head = { origin: [-hw / 2, hy, hz - hd], size: [hw, hh, hd], mat: 'face', marks: eyes(hd, h.eye ?? { back: 1, down: 1 }) };
  const headCubes = [head];
  if (o.muzzle) {
    const m = o.muzzle;
    const [mw, mh, md] = m.size;
    headCubes.push({
      origin: [-mw / 2, hy + (m.dy ?? 0), hz - hd - md], size: [mw, mh, md], mat: m.mat ?? 'muzzle',
      marks: m.nose === false ? [] : [{ face: 'front', x: 0, y: 0, w: mw, h: 1, color: m.nose ?? '#141010' }],
    });
  }
  Object.assign(ctx, { head, hz, hy, htop, hw, hh, hd });
  headCubes.push(...(o.headExtras?.(ctx) ?? []));
  bones.push({ name: 'head', parent: 'body', pivot: [0, hy + hh / 2, hz], rotation: [h.pitch ?? 0, 0, 0], cubes: headCubes });
  bones.push(...(o.headBones?.(ctx) ?? []));

  if (o.ears) {
    const e = o.ears;
    const [ew, eh, ed] = e.size;
    const ez = hz - (e.z ?? 1) - ed;
    const ey = htop - (e.sink ?? 1);
    const ex = e.x ?? 1;
    const mk = (name, x0, side) => ({
      name, parent: 'head', pivot: [x0 + ew / 2, ey, ez + ed / 2], rotation: [e.tilt ?? 0, 0, side * (e.splay ?? 0)],
      cubes: [{ origin: [x0, ey, ez], size: [ew, eh, ed], mat: 'ear' }],
    });
    bones.push(mk('ear_l', ex, 1), mk('ear_r', -ex - ew, -1));
  }

  bones.push(...legs4({
    x: W / 2 - (o.legInset ?? 0), front: zf + (o.frontInset ?? 1), back: zb - (o.backInset ?? 1) - legD,
    w: legW, d: legD, h: legH + 1, foot: o.foot ?? 1, mat: 'leg', footMat: 'paw',
    frontH: o.frontH, frontW: o.frontW, backW: o.backW,
  }));

  const organs = [...torsoOrgans('body', body, o.organs ?? {}), ...headOrgans('head', head, o.brain)];
  return { bones, organs };
}

/** Wild boar: deep, high-shouldered body, wedge head with a long snout, tusks, bristle ridge. */
export function suid({
  bodyW = 8, bodyH = 9, bodyL = 18, legH = 6,
} = {}) {
  const top = legH + bodyH, zf = -bodyL / 2;
  return mammal({
    body: [bodyW, bodyH, bodyL], legH, legW: 2, legD: 3, legInset: 1, frontInset: 2, backInset: 1,
    bodyExtras: ({ top, zf, zb }) => [
      // Withers: the high, heavy shoulders, and a mane of long bristles along the spine.
      { origin: [-3, top, zf + 1], size: [6, 2, 8], mat: 'hide' },
      { origin: [-1, top + 2, zf + 1], size: [2, 1, 9], mat: 'bristle' },
      { origin: [-1, top, zf + 9], size: [2, 1, 6], mat: 'bristle' },
      // Rump rounding.
      { origin: [-3, top - 1, zb - 1], size: [6, 1, 1], mat: 'hide' },
    ],
    head: { size: [6, 7, 5], y: top - 8, z: zf + 1, pitch: 10, eye: { back: 1, down: 2 } },
    muzzle: { size: [4, 4, 5], dy: 0, mat: 'snout', nose: false },
    headExtras: ({ hy, hz, hd }) => [
      // Nose disc.
      { origin: [-2, hy, hz - hd - 6], size: [4, 4, 1], mat: 'disc', marks: nostrils(4, { down: 2, gap: 2 }) },
      // Cheek bristles.
      { origin: [-3.5, hy - 1, hz - hd + 1], size: [7, 3, 3], mat: 'cheek' },
    ],
    headBones: ({ hy, hz, hd }) => [{
      name: 'tusks', parent: 'head', pivot: [0, hy + 1, hz - hd - 4],
      cubes: [
        { origin: [2, hy, hz - hd - 4], size: [1, 3, 1], mat: 'tusk' },
        { origin: [-3, hy, hz - hd - 4], size: [1, 3, 1], mat: 'tusk' },
      ],
    }],
    ears: { size: [2, 3, 1], x: 1, z: 1, splay: 22, tilt: 10 },
    tail: { size: [1, 6, 1], y: 1, rot: 12, cubes: (ty, tz) => [
      { origin: [-0.5, ty - 6, tz], size: [1, 6, 1], mat: 'tail' },
      { origin: [-1, ty - 8, tz - 0.5], size: [2, 2, 2], mat: 'bristle' },
    ] },
    // Thick gristle over the shoulders: a bigger shoulder box.
    organs: { shoulder: [[0, 0.4], [0.28, 0.92], 0.28] },
    brain: { f: [0.4, 0.85], g: [0.45, 0.85], w: 0.5 },
  });
}

/** Black bear: big rounded body with a shoulder hump, heavy legs, broad head, short muzzle, round ears. */
export function ursid({ bodyW = 10, bodyH = 9, bodyL = 18, legH = 6 } = {}) {
  const top = legH + bodyH, zf = -bodyL / 2;
  return mammal({
    body: [bodyW, bodyH, bodyL], legH, legW: 4, legD: 4, legInset: 0.5, frontInset: 1, backInset: 1, foot: 1,
    bodyExtras: ({ top, zf, zb }) => [
      // Shoulder hump and rounded rump.
      { origin: [-4, top, zf + 1], size: [8, 1, 8], mat: 'hide' },
      { origin: [-4, top, zb - 7], size: [8, 1, 6], mat: 'hide' },
      // Rounded flanks.
      { origin: [-bodyW / 2 - 1, legH + 2, zf + 2], size: [bodyW + 2, bodyH - 4, bodyL - 4], mat: 'hide' },
      // Thick short neck.
      { origin: [-4, top - 8, zf - 3], size: [8, 7, 4], mat: 'hide', zone: 'neck' },
    ],
    head: { size: [7, 6, 5], y: top - 7, z: zf - 2, pitch: 6, eye: { back: 1, down: 2, color: '#4a3020' } },
    muzzle: { size: [4, 3, 4], dy: 0, nose: false },
    headExtras: ({ hy, hz, hd }) => [
      { origin: [-1, hy + 2, hz - hd - 4.5], size: [2, 1, 1], mat: 'nose' },
    ],
    ears: { size: [2, 2, 1], x: 2, z: 1, splay: 15, sink: 0 },
    tail: { size: [3, 2, 2], y: 2, rot: 40, inset: 1 },
    brain: { f: [0.35, 0.85], g: [0.35, 0.8], w: 0.55 },
  });
}

/** Wolf / fox. Long legs, a ruff over the chest, long muzzle, pointed ears, bushy tail. */
export function canid({
  bodyW = 6, bodyH = 6, bodyL = 14, legH = 8, legW = 2,
  ruff = true, headW = 5, headH = 5, headD = 4, muzzle = [3, 2, 4],
  ear = [2, 3, 1], earX = 0.5, tail = [3, 8, 3], tailRot = 30, headUp = 1, pitch = 0, legInset = 0.5,
} = {}) {
  const top = legH + bodyH, zf = -bodyL / 2;
  return mammal({
    body: [bodyW, bodyH, bodyL], legH, legW, legD: legW, legInset, frontInset: 1, backInset: 1, foot: 1,
    bodyExtras: ({ bottom, top, zf }) => (ruff ? [
      { origin: [-bodyW / 2 - 1, bottom, zf - 1], size: [bodyW + 2, bodyH + 1, 5], mat: 'ruff' },
    ] : []),
    head: { size: [headW, headH, headD], y: top - headH + headUp + 1, z: zf + (ruff ? 0 : 1), pitch, eye: { back: 1, down: 1 } },
    muzzle: { size: muzzle, dy: 0 },
    ears: { size: ear, x: earX, z: 1, splay: 8, tilt: -5 },
    tail: { size: tail, y: 1, rot: tailRot, inset: 1 },
    brain: { f: [0.4, 0.9], g: [0.35, 0.85], w: 0.6 },
  });
}

/** Hare: compact body, big hind legs, high head, very long ears, short tail held up. */
export function leporid({ bodyW = 4, bodyH = 4, bodyL = 9, legH = 4 } = {}) {
  const top = legH + bodyH, zf = -bodyL / 2;
  return mammal({
    body: [bodyW, bodyH, bodyL], legH, legW: 1, legD: 2, frontW: 1, backW: 2, legInset: 0, frontInset: 1, backInset: 1, foot: 1,
    bodyExtras: ({ bottom, top, zb }) => [
      // Haunches over the hind legs and the high, rounded rump.
      { origin: [-bodyW / 2 - 1, bottom, zb - 5], size: [bodyW + 2, 3, 4], mat: 'hide' },
      { origin: [-bodyW / 2 + 0.5, top, zb - 6], size: [bodyW - 1, 1, 5], mat: 'hide' },
    ],
    head: { size: [4, 4, 4], y: top - 1, z: zf + 1, pitch: 5, eye: { back: 1, down: 1, color: '#2a1a10' } },
    muzzle: { size: [2, 2, 1], dy: 0, nose: '#7a5a4a' },
    ears: { size: [2, 7, 1], x: 0.5, z: 1, splay: 14, tilt: -25 },
    tail: { size: [2, 2, 2], cubes: (ty, tz) => [{ origin: [-1, ty - 1, tz - 1], size: [2, 2, 2], mat: 'tail' }], y: 1, rot: -20 },
    brain: { f: [0.45, 0.9], g: [0.4, 0.85], w: 0.6 },
  });
}

/**
 * Bounding gait for hares: front legs together, hind legs together, body bobbing.
 * Replaces quadruped()'s walk/run.
 */
export function bound({ walkLength = 0.5, runLength = 0.35 } = {}) {
  const cyc = (len, n, f) => Object.fromEntries([...Array(n + 1)].map((_, k) => [((k / n) * len).toFixed(2), f((k % n) / n).map((v) => Math.round(v * 100) / 100)]));
  const s = (p, o = 0) => Math.sin((p + o) * Math.PI * 2);
  const gait = (len, amp, lift) => ({
    loop: true, animation_length: len,
    bones: {
      leg_fl: { rotation: cyc(len, 8, (p) => [amp * s(p), 0, 0]) },
      leg_fr: { rotation: cyc(len, 8, (p) => [amp * s(p), 0, 0]) },
      leg_bl: { rotation: cyc(len, 8, (p) => [amp * 1.3 * s(p, 0.5), 0, 0]) },
      leg_br: { rotation: cyc(len, 8, (p) => [amp * 1.3 * s(p, 0.5), 0, 0]) },
      body: { position: cyc(len, 8, (p) => [0, lift * Math.max(0, s(p, 0.25)), 0]), rotation: cyc(len, 8, (p) => [-6 * s(p), 0, 0]) },
      ear_l: { rotation: cyc(len, 8, (p) => [-10 + 6 * s(p), 0, 0]) },
      ear_r: { rotation: cyc(len, 8, (p) => [-10 + 6 * s(p), 0, 0]) },
    },
  });
  return { walk: gait(walkLength, 35, 1.5), run: gait(runLength, 55, 2.5) };
}
