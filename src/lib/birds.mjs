// Body plan and animations for game birds (pheasant, mallard, wild turkey).
// Sizes in pixels; the bird faces -z, +x is its left. Returns { bones, organs }.
import { bird, extras } from './anim.mjs';
import { headOrgans, torsoOrgans } from './hitmodel.mjs';
import { eyes } from './parts.mjs';

/**
 * Ground-dwelling game bird. Also returns `ctx` (body top/bottom, neck top, head box) so a
 * species can place texture regions.
 * Bones: root, body, neck, head, wing_l, wing_r, tail, leg_l, leg_r, plus any `extraBones`
 * (male-only plumage such as a tail fan), which get the context below to place themselves.
 * Materials: body, breast, wing, neck, head, beak, tail, leg (+ whatever `extra` cubes use).
 *
 * beak: { w, h, d, y } (y = height above the bottom of the head), flat bills are just h = 1.
 * tail: { w, h, l, angle } — a plank from the back of the body, angle > 0 raises it.
 * foot: { w, d } — the toes, centred on the leg and reaching forward.
 * headExtras(head) => cubes added to the head bone (wattles, snood, crest).
 * extraBones(ctx) => bones (parents: body/tail/head) for plumage only some variants show.
 */
export function gamebird({
  bodyW = 4, bodyH = 4, bodyL = 8, legH = 4, legW = 1, legGap = 0, legZ = 0, foot = { w: 1, d: 3 },
  neckW = 2, neckH = 4, neckD = 2, neckTilt = 15, neckZ = 0,
  headW = 3, headH = 3, headD = 3, headMarks, beak = { w: 1, h: 1, d: 1, y: 1 },
  tail = { w: 2, h: 1, l: 4, angle: 10 }, wingInset = 1, breast = true,
  headExtras, extraBones,
} = {}) {
  const bottom = legH, top = legH + bodyH;
  const zf = -bodyL / 2, zb = bodyL / 2;
  const body = { origin: [-bodyW / 2, bottom, zf], size: [bodyW, bodyH, bodyL], mat: 'body' };
  const bodyCubes = [body];
  // A rounded breast: one pixel proud of the front, a little smaller than the body.
  if (breast) bodyCubes.push({ origin: [-bodyW / 2 + 1, bottom + 1, zf - 1], size: [bodyW - 2, bodyH - 2, 1], mat: 'breast' });

  // Neck rises from the front top of the body.
  const nz = zf + neckZ; // neck front edge
  const neck = { origin: [-neckW / 2, top - 2, nz], size: [neckW, neckH + 1, neckD], mat: 'neck' };
  const neckTop = top - 1 + neckH;
  const hz = nz + neckD; // head back edge = neck back edge
  const head = {
    origin: [-headW / 2, neckTop - 1, hz - headD], size: [headW, headH, headD], mat: 'head',
    marks: headMarks ?? eyes(headD, { back: 1, down: 1 }),
  };
  const bill = { origin: [-beak.w / 2, neckTop - 1 + beak.y, hz - headD - beak.d], size: [beak.w, beak.h, beak.d], mat: 'beak' };
  const headCtx = { top: neckTop - 1 + headH, bottom: neckTop - 1, front: hz - headD, back: hz, w: headW, h: headH, d: headD };

  // Wings fold along the flanks, tips reaching past the rump.
  const wingH = bodyH - wingInset;
  const wingL = bodyL - 1;
  const wing = (side) => {
    const x0 = side > 0 ? bodyW / 2 : -bodyW / 2 - 1;
    return {
      name: side > 0 ? 'wing_l' : 'wing_r', parent: 'body', pivot: [side > 0 ? bodyW / 2 : -bodyW / 2, top, 0],
      cubes: [{ origin: [x0, top - wingH, zf + 1], size: [1, wingH, wingL], mat: 'wing' }],
    };
  };

  const tailBone = {
    name: 'tail', parent: 'body', pivot: [0, top - 1, zb], rotation: [tail.angle ?? 10, 0, 0],
    cubes: [{ origin: [-tail.w / 2, top - 1 - tail.h, zb - 1], size: [tail.w, tail.h, tail.l + 1], mat: 'tail' }],
  };

  // Legs hang from the middle of the body; the shank reaches 1px up into the belly.
  const leg = (side) => {
    const x0 = side > 0 ? legGap / 2 : -legGap / 2 - legW;
    const z = legZ - legW / 2;
    return {
      name: side > 0 ? 'leg_l' : 'leg_r', parent: 'root', pivot: [x0 + legW / 2, legH, z + legW / 2],
      cubes: [
        { origin: [x0 + legW / 2 - foot.w / 2, 0, z + legW - foot.d], size: [foot.w, 1, foot.d], mat: 'foot' },
        { origin: [x0, 1, z], size: [legW, legH, legW], mat: 'leg' },
      ],
    };
  };

  const ctx = { bottom, top, zf, zb, bodyW, bodyH, bodyL, neckTop, head: headCtx, tailAngle: tail.angle ?? 10 };
  const bones = [
    { name: 'root', pivot: [0, 0, 0] },
    { name: 'body', parent: 'root', pivot: [0, bottom + bodyH / 2, 0], cubes: bodyCubes },
    { name: 'neck', parent: 'body', pivot: [0, top - 2, nz + neckD / 2], rotation: [neckTilt, 0, 0], cubes: [neck] },
    {
      name: 'head', parent: 'neck', pivot: [0, neckTop - 1, nz + neckD / 2], rotation: [-neckTilt, 0, 0],
      cubes: [head, bill, ...(headExtras ? headExtras(headCtx) : [])],
    },
    wing(1), wing(-1), tailBone,
    ...(extraBones ? extraBones(ctx) : []),
    leg(1), leg(-1),
  ];

  // Bird anatomy: the heart sits low in the front of the breast behind the keel, the lungs
  // up against the back ribs, the liver around and behind the heart, the gizzard further
  // back. "shoulder" is the wing joint, "ham" the thighs in the middle of the body.
  const organs = [
    ...torsoOrgans('body', body, {
      spine: [[0, 1], [0.84, 1], 0.3],
      heart: [[0.08, 0.34], [0.12, 0.52], 0.5],
      lungs: [[0.06, 0.5], [0.5, 0.86], 0.76],
      liver: [[0.3, 0.55], [0.1, 0.5], 0.8],
      stomach: [[0.55, 0.82], [0.08, 0.6], 0.7],
      shoulder: [[0, 0.3], [0.56, 0.86], 0.2],
      ham: [[0.5, 0.86], [0, 0.5], 1],
    }),
    ...headOrgans('head', head, { f: [0.3, 0.9], g: [0.35, 0.9], w: 0.6 }),
  ];
  return { bones, organs, ctx };
}

/**
 * Animations for a game bird: walk/run/idle/eat/fly/glide/sleep plus the hunting states.
 * The hunting alert flicks the tail up a little instead of a deer's flag. `swims` adds a
 * paddling swim (ducks).
 */
export function birdAnims({ width = 4, swims = false, tailAlert = 15, ...o } = {}) {
  const base = bird({ neck: 'neck', head: 'head', ...o });
  const hunt = extras.hunting({ neck: 'neck', width, stampLeg: 'leg_r' });
  hunt.alert.bones.tail = { rotation: [tailAlert, 0, 0] };
  const out = { ...base, ...hunt };
  if (swims) {
    const k = (t) => t.toFixed(2);
    const paddle = (off) => Object.fromEntries([0, 0.25, 0.5, 0.75, 1].map((p) => [k(p * 1.2), [-30 + 50 * Math.sin((p + off) * Math.PI * 2), 0, 0].map((v) => Math.round(v))]));
    out.swim = {
      loop: true, animation_length: 1.2,
      bones: {
        leg_l: { rotation: paddle(0) }, leg_r: { rotation: paddle(0.5) },
        neck: { rotation: { '0.00': [0, 0, 0], '0.60': [4, 0, 0], '1.20': [0, 0, 0] } },
      },
    };
  }
  return out;
}
