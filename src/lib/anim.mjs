// Keyframed animation templates. Everything is plain keyframes (no Molang), so
// the files are portable to other engines (e.g. GeckoLib) if Java returns.
//
// Rotation convention (Bedrock): +x pitches a bone's front (-z) downwards and
// swings a hanging leg backwards; +z rolls towards the animal's right.

const r = (n) => Math.round(n * 100) / 100;
const TAU = Math.PI * 2;

/** Sample f(phase in [0,1)) into n keyframes over `length` seconds (looping). */
function cycle(length, n, f) {
  const out = {};
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * length;
    out[r(t).toFixed(2)] = f((k % n) / n).map(r);
  }
  return out;
}

const sin = (phase, offset = 0) => Math.sin((phase + offset) * TAU);

/** Merge bone channels (later wins per channel). */
function bones(...parts) {
  const out = {};
  for (const p of parts) {
    for (const [bone, channels] of Object.entries(p)) {
      if (!bone || bone === 'undefined') continue;
      out[bone] = { ...(out[bone] ?? {}), ...channels };
    }
  }
  return out;
}

const loop = (length, b) => ({ loop: true, animation_length: length, bones: b });
const once = (length, b) => ({ animation_length: length, bones: b });
const hold = (b) => ({ loop: true, bones: b });

// ---------------------------------------------------------------- body plans

/**
 * Four-legged walkers (cats, hoofed animals, hyena, meerkat, primates on all fours).
 * opts: legs {fl,fr,bl,br}, head, neck, tail[], ears[], body, swing, walkLength, runLength,
 *       pace, sleepDrop (how far the body sinks when lying down), legFold.
 * Legs must be children of `root` (not `body`) so the body can sink without them.
 */
export function quadruped(o) {
  const L = { fl: 'leg_fl', fr: 'leg_fr', bl: 'leg_bl', br: 'leg_br', ...(o.legs ?? {}) };
  const head = o.head ?? 'head';
  const neck = o.neck;
  const body = o.body ?? 'body';
  const tails = o.tail ?? [];
  const ears = o.ears ?? [];
  const swing = o.swing ?? 30;
  const n = 8;

  const legs = (len, amp, pace) => {
    // Walk: diagonal pairs; pace (camel/giraffe): same-side pairs.
    const off = { fl: 0, br: pace ? 0.5 : 0, fr: 0.5, bl: pace ? 0 : 0.5 };
    return Object.fromEntries(
      Object.entries(L).map(([k, bone]) => [bone, { rotation: cycle(len, n, (p) => [amp * sin(p, off[k]), 0, 0]) }]),
    );
  };
  const tailSway = (len, amp) =>
    Object.fromEntries(tails.map((t, i) => [t, { rotation: cycle(len, n, (p) => [0, amp * sin(p, -i * 0.15), 0]) }]));

  const walkLen = o.walkLength ?? 1.0;
  const runLen = o.runLength ?? 0.5;
  const drop = o.sleepDrop ?? 6;
  const fold = o.legFold ?? 80;

  return {
    walk: loop(walkLen, bones(
      legs(walkLen, swing, o.pace),
      { [neck ?? head]: { rotation: cycle(walkLen, n, (p) => [2 * sin(p * 2), 0, 0]) } },
      tailSway(walkLen, 8),
    )),
    run: loop(runLen, bones(
      legs(runLen, swing * 1.5, false),
      { [body]: { rotation: cycle(runLen, n, (p) => [3 * sin(p * 2), 0, 0]), position: cycle(runLen, n, (p) => [0, 0.6 * Math.abs(sin(p)), 0]) } },
      { [neck ?? head]: { rotation: cycle(runLen, n, (p) => [4 * sin(p * 2, 0.25), 0, 0]) } },
      Object.fromEntries(tails.map((t) => [t, { rotation: cycle(runLen, n, (p) => [35 + 5 * sin(p * 2), 0, 0]) }])),
    )),
    idle: loop(4, bones(
      tailSway(4, 12),
      Object.fromEntries(ears.map((e, i) => [e, { rotation: cycle(4, n, (p) => [0, 0, (i % 2 ? -1 : 1) * 6 * Math.max(0, sin(p * 2, 0.1))]) }])),
      { [head]: { rotation: cycle(4, n, (p) => [1.5 * sin(p), 3 * sin(p, 0.3), 0]) } },
    )),
    eat: loop(2, bones({
      [neck ?? head]: { rotation: cycle(2, n, (p) => [(neck ? 55 : 40) + 5 * sin(p * 4), 0, 0]) },
      ...(neck ? { [head]: { rotation: cycle(2, n, (p) => [10 + 4 * sin(p * 4), 0, 0]) } } : {}),
    })),
    attack: once(0.5, bones({
      [neck ?? head]: { rotation: { '0.0': [0, 0, 0], '0.15': [-20, 0, 0], '0.3': [25, 0, 0], '0.5': [0, 0, 0] } },
      [body]: { position: { '0.0': [0, 0, 0], '0.15': [0, 0, 1], '0.3': [0, 0, -2], '0.5': [0, 0, 0] } },
    })),
    sleep: hold(bones(
      { [body]: { position: [0, -drop, 0] } },
      { [L.fl]: { rotation: [-fold, 0, 0], position: [0, -drop, 0] }, [L.fr]: { rotation: [-fold, 0, 0], position: [0, -drop, 0] } },
      { [L.bl]: { rotation: [fold, 0, 0], position: [0, -drop, 0] }, [L.br]: { rotation: [fold, 0, 0], position: [0, -drop, 0] } },
      { [neck ?? head]: { rotation: [neck ? 35 : 15, 25, 0] } },
      Object.fromEntries(tails.slice(0, 1).map((t) => [t, { rotation: [20, 50, 0] }])),
    )),
    sit: hold(bones(
      { [body]: { rotation: [-25, 0, 0], position: [0, -drop / 2, 0] } },
      { [L.bl]: { rotation: [-60, 0, 0], position: [0, -drop / 2, 2] }, [L.br]: { rotation: [-60, 0, 0], position: [0, -drop / 2, 2] } },
      { [L.fl]: { rotation: [25, 0, 0] }, [L.fr]: { rotation: [25, 0, 0] } },
      { [neck ?? head]: { rotation: [20, 0, 0] } },
    )),
    // A short sprint lunge used by charging and pouncing animals.
    pounce: once(0.6, bones({
      [body]: { rotation: { '0.0': [0, 0, 0], '0.2': [-15, 0, 0], '0.45': [10, 0, 0], '0.6': [0, 0, 0] } },
      [L.fl]: { rotation: { '0.0': [0, 0, 0], '0.2': [-60, 0, 0], '0.6': [0, 0, 0] } },
      [L.fr]: { rotation: { '0.0': [0, 0, 0], '0.2': [-60, 0, 0], '0.6': [0, 0, 0] } },
    })),
  };
}

/** Two-legged birds (ostrich, flamingo, vulture on the ground). */
export function bird(o) {
  const head = o.head ?? 'head', neck = o.neck ?? head, body = o.body ?? 'body';
  const ll = o.legL ?? 'leg_l', lr = o.legR ?? 'leg_r';
  const wl = o.wingL ?? 'wing_l', wr = o.wingR ?? 'wing_r';
  const swing = o.swing ?? 35;
  const n = 8;
  const walkLen = o.walkLength ?? 0.8;
  const runLen = o.runLength ?? 0.4;
  const legs = (len, amp) => ({
    [ll]: { rotation: cycle(len, n, (p) => [amp * sin(p), 0, 0]) },
    [lr]: { rotation: cycle(len, n, (p) => [amp * sin(p, 0.5), 0, 0]) },
  });
  const flap = (len, amp, base = 0) => ({
    [wl]: { rotation: cycle(len, n, (p) => [0, 0, -(base + amp * sin(p))]) },
    [wr]: { rotation: cycle(len, n, (p) => [0, 0, base + amp * sin(p)]) },
  });
  return {
    walk: loop(walkLen, bones(legs(walkLen, swing), { [neck]: { rotation: cycle(walkLen, n, (p) => [6 * sin(p * 2), 0, 0]) } })),
    run: loop(runLen, bones(
      legs(runLen, swing * 1.5),
      { [neck]: { rotation: cycle(runLen, n, (p) => [20 + 6 * sin(p * 2), 0, 0]) } },
      flap(runLen, 10, 25),
    )),
    idle: loop(3, bones({ [head]: { rotation: cycle(3, n, (p) => [3 * sin(p), 10 * sin(p, 0.3), 0]) } })),
    eat: loop(2, bones({ [neck]: { rotation: cycle(2, n, (p) => [70 + 8 * sin(p * 4), 0, 0]) } })),
    attack: once(0.5, bones({ [neck]: { rotation: { '0.0': [0, 0, 0], '0.2': [-25, 0, 0], '0.35': [40, 0, 0], '0.5': [0, 0, 0] } } })),
    fly: loop(0.8, bones(flap(0.8, o.flapAmp ?? 35, o.flyBase ?? 10), { [ll]: { rotation: [50, 0, 0] }, [lr]: { rotation: [50, 0, 0] } })),
    glide: loop(3, bones(flap(3, 4, o.glideBase ?? -5), { [ll]: { rotation: [50, 0, 0] }, [lr]: { rotation: [50, 0, 0] } })),
    sleep: hold(bones(
      { [body]: { position: [0, -(o.sleepDrop ?? 4), 0] } },
      { [ll]: { rotation: [-80, 0, 0], position: [0, -(o.sleepDrop ?? 4), 0] }, [lr]: { rotation: [-80, 0, 0], position: [0, -(o.sleepDrop ?? 4), 0] } },
      { [neck]: { rotation: [-30, 120, 0] } },
    )),
    // Flamingo: one leg tucked.
    one_leg: hold(bones({ [lr]: { rotation: [-110, 0, 0], position: [0, 4, 0] } })),
  };
}

/** Upright primates and other bipeds with arms (gorilla, chimp, baboon walk on all fours via quadruped). */
export function primate(o) {
  const body = o.body ?? 'body', head = o.head ?? 'head';
  const al = o.armL ?? 'arm_l', ar = o.armR ?? 'arm_r';
  const n = 8;
  return {
    chest_beat: once(1.6, bones({
      [body]: { rotation: { '0.0': [0, 0, 0], '0.2': [-35, 0, 0], '1.4': [-35, 0, 0], '1.6': [0, 0, 0] } },
      [al]: { rotation: cycle(1.6, 16, (p) => (p < 0.12 || p > 0.88 ? [0, 0, 0] : [-130 + 25 * sin(p * 8), 0, -15])) },
      [ar]: { rotation: cycle(1.6, 16, (p) => (p < 0.12 || p > 0.88 ? [0, 0, 0] : [-130 + 25 * sin(p * 8, 0.5), 0, 15])) },
      [head]: { rotation: { '0.0': [0, 0, 0], '0.3': [-20, 0, 0], '1.3': [-20, 0, 0], '1.6': [0, 0, 0] } },
    })),
    throw: once(0.6, bones({
      [ar]: { rotation: { '0.0': [0, 0, 0], '0.25': [-160, 0, 0], '0.4': [-40, 0, 0], '0.6': [0, 0, 0] } },
    })),
    groom: loop(2, bones({
      [al]: { rotation: cycle(2, n, (p) => [-70 + 10 * sin(p * 2), 20, 0]) },
      [head]: { rotation: cycle(2, n, (p) => [25 + 5 * sin(p * 2), 15, 0]) },
    })),
  };
}

/** Long low reptiles (crocodile). */
export function reptile(o) {
  const L = { fl: 'leg_fl', fr: 'leg_fr', bl: 'leg_bl', br: 'leg_br', ...(o.legs ?? {}) };
  const tails = o.tail ?? [];
  const jaw = o.jaw ?? 'jaw', body = o.body ?? 'body';
  const n = 8;
  const sway = (len, amp) =>
    Object.fromEntries(tails.map((t, i) => [t, { rotation: cycle(len, n, (p) => [0, amp * (1 + i * 0.5) * sin(p, -i * 0.2), 0]) }]));
  const legs = (len, amp) =>
    Object.fromEntries(Object.entries(L).map(([k, bone]) => {
      const off = { fl: 0, br: 0, fr: 0.5, bl: 0.5 }[k];
      return [bone, { rotation: cycle(len, n, (p) => [0, amp * sin(p, off), 0]) }];
    }));
  return {
    walk: loop(1.2, bones(legs(1.2, 30), sway(1.2, 10), { [body]: { rotation: cycle(1.2, n, (p) => [0, 4 * sin(p), 0]) } })),
    run: loop(0.6, bones(legs(0.6, 40), sway(0.6, 14))),
    swim: loop(1.6, bones(
      sway(1.6, 22),
      Object.fromEntries(Object.values(L).map((b) => [b, { rotation: [0, 0, 0], position: [0, 0, 1] }])),
    )),
    idle: loop(5, bones(sway(5, 4))),
    attack: once(0.5, bones({ [jaw]: { rotation: { '0.0': [0, 0, 0], '0.15': [35, 0, 0], '0.3': [0, 0, 0], '0.5': [0, 0, 0] } } })),
    jaw_open: hold(bones({ [jaw]: { rotation: [30, 0, 0] } })),
    // Death roll when it grabs prey.
    roll: once(1.0, bones({ [body]: { rotation: { '0.0': [0, 0, 0], '0.5': [0, 0, 180], '1.0': [0, 0, 360] } } })),
  };
}

/** Extra one-off animations shared by several species. */
export const extras = {
  /** Head raised with open jaw, for roars and trumpets. */
  roar: ({ head = 'head', jaw, neck } = {}) =>
    once(1.5, bones(
      { [neck ?? head]: { rotation: { '0.0': [0, 0, 0], '0.3': [-25, 0, 0], '1.2': [-25, 0, 0], '1.5': [0, 0, 0] } } },
      jaw ? { [jaw]: { rotation: { '0.0': [0, 0, 0], '0.3': [35, 0, 0], '1.2': [35, 0, 0], '1.5': [0, 0, 0] } } } : {},
    )),
  /** Elephant trunk swing (idle) and raise (trumpet). */
  trunk: (segments) => ({
    trunk_idle: loop(3, bones(Object.fromEntries(segments.map((s, i) => [s, { rotation: cycle(3, 8, (p) => [4 * sin(p, i * 0.15), 0, 5 * sin(p, 0.3 + i * 0.15)]) }])))),
    trumpet: once(2, bones(Object.fromEntries(segments.map((s, i) => [s, { rotation: { '0.0': [0, 0, 0], '0.4': [-35 - i * 10, 0, 0], '1.6': [-35 - i * 10, 0, 0], '2.0': [0, 0, 0] } }])))),
  }),
  /** Meerkat sentry: rear up on hind legs and look around. */
  stand: ({ body = 'body', head = 'head', legs = {} } = {}) =>
    hold(bones(
      { [body]: { rotation: [-80, 0, 0], position: [0, 3, 1] } },
      { [head]: { rotation: [75, 0, 0] } },
      { [legs.fl ?? 'leg_fl']: { rotation: [80, 0, 0], position: [0, 3, 3] }, [legs.fr ?? 'leg_fr']: { rotation: [80, 0, 0], position: [0, 3, 3] } },
    )),
  /** Head looks around slowly (sentry). */
  scan: ({ head = 'head' } = {}) => loop(4, { [head]: { rotation: cycle(4, 8, (p) => [0, 50 * sin(p), 0]) } }),
  /** Gazelle pronk: all four legs stiff, body bounces. */
  pronk: ({ body = 'body' } = {}) =>
    once(0.6, bones({ [body]: { position: { '0.0': [0, 0, 0], '0.3': [0, 6, 0], '0.6': [0, 0, 0] } } })),
  /**
   * Hunting states shared by every game animal: `alert` (head up, ears forward, tail raised
   * like a white-tail's flag), `dead` (lying on its side), `stamp` (a warning foot stamp).
   */
  hunting: ({ neck, head = 'head', tail, ears = [], width = 6, root = 'root', stampLeg = 'leg_fr' } = {}) => ({
    alert: hold(bones(
      { [neck ?? head]: { rotation: [neck ? -22 : -12, 0, 0] } },
      neck ? { [head]: { rotation: [8, 0, 0] } } : {},
      // +x swings a hanging tail back and up (flagging) and tips upright ears forward.
      Object.fromEntries(ears.map((e) => [e, { rotation: [15, 0, 0] }])),
      tail ? { [tail]: { rotation: [70, 0, 0] } } : {},
    )),
    dead: hold(bones(
      { [root]: { rotation: [0, 0, 90], position: [width / 2 + 0.5, 0, 0] } },
      { [neck ?? head]: { rotation: [neck ? -10 : 0, 0, 0] } },
    )),
    stamp: once(0.6, bones({ [stampLeg]: { rotation: { '0.0': [0, 0, 0], '0.2': [-45, 0, 0], '0.35': [5, 0, 0], '0.6': [0, 0, 0] } } })),
  }),
  /** Big mouth yawn (hippo threat display). */
  yawn: ({ jaw = 'jaw', head = 'head' } = {}) =>
    once(2.0, bones(
      { [head]: { rotation: { '0.0': [0, 0, 0], '0.4': [-30, 0, 0], '1.6': [-30, 0, 0], '2.0': [0, 0, 0] } } },
      { [jaw]: { rotation: { '0.0': [0, 0, 0], '0.4': [70, 0, 0], '1.6': [70, 0, 0], '2.0': [0, 0, 0] } } },
    )),
};

/** Wrap per-species animations into a Bedrock animation file. */
export function animationFile(id, anims) {
  const out = {};
  for (const [name, a] of Object.entries(anims)) out[`animation.hunting.${id}.${name}`] = a;
  return { format_version: '1.8.0', animations: out };
}

/** Fish: side-to-side tail beat; the body follows a little. A dead fish turns belly up. */
export function fish(o = {}) {
  const body = o.body ?? 'body', tail = o.tail ?? 'tail', jaw = o.jaw, root = o.root ?? 'root';
  const caudal = o.caudal, fins = o.fins ?? [];
  const n = 8;
  const beat = (len, amp) => bones(
    { [tail]: { rotation: cycle(len, n, (p) => [0, amp * sin(p), 0]) } },
    caudal ? { [caudal]: { rotation: cycle(len, n, (p) => [0, amp * 0.6 * sin(p, -0.15), 0]) } } : {},
    { [body]: { rotation: cycle(len, n, (p) => [0, amp * 0.25 * sin(p, 0.5), 0]) } },
    Object.fromEntries(fins.map((f, i) => [f, { rotation: cycle(len, n, (p) => [0, (i % 2 ? -1 : 1) * amp * 0.5 * sin(p, 0.25), 0]) }])),
  );
  return {
    swim: loop(o.swimLength ?? 0.6, beat(o.swimLength ?? 0.6, o.amp ?? 25)),
    idle: loop(1.6, beat(1.6, 10)),
    dead: hold({ [root]: { rotation: [0, 0, 180] } }),
    attack: once(0.4, bones(
      { [body]: { position: { '0.0': [0, 0, 0], '0.15': [0, 0, -2], '0.4': [0, 0, 0] } } },
      jaw ? { [jaw]: { rotation: { '0.0': [0, 0, 0], '0.1': [30, 0, 0], '0.25': [0, 0, 0], '0.4': [0, 0, 0] } } } : {},
    )),
  };
}

/** Long bodies made of a chain of segments (snakes, eels, centipedes): a travelling wave. */
export function serpent(o) {
  const segs = o.segments; // head first
  const n = 8;
  const wave = (len, amp) => Object.fromEntries(segs.map((s, i) => [s, { rotation: cycle(len, n, (p) => [0, amp * sin(p, -i * 0.18), 0]) }]));
  return {
    walk: loop(1.4, wave(1.4, o.amp ?? 18)),
    run: loop(0.8, wave(0.8, (o.amp ?? 18) * 1.3)),
    swim: loop(1.2, wave(1.2, (o.amp ?? 18) * 1.4)),
    idle: loop(4, bones(
      wave(4, 4),
      o.tongue ? { [o.tongue]: { scale: { '0.0': [1, 1, 0], '2.6': [1, 1, 0], '2.8': [1, 1, 1], '3.0': [1, 1, 0], '4.0': [1, 1, 0] } } } : {},
    )),
    attack: once(0.6, bones(
      { [segs[0]]: { rotation: { '0.0': [0, 0, 0], '0.15': [-25, 0, 0], '0.3': [15, 0, 0], '0.6': [0, 0, 0] }, position: { '0.0': [0, 0, 0], '0.2': [0, 1, -4], '0.6': [0, 0, 0] } } },
      o.jaw ? { [o.jaw]: { rotation: { '0.0': [0, 0, 0], '0.15': [40, 0, 0], '0.35': [0, 0, 0] } } } : {},
    )),
    ...(o.coil ? { coil: coil(segs[0], segs.slice(1), o.tongue) } : {}),
  };
}

/**
 * Threat display: the front of the body rears up off the ground (cobras raise about a
 * third of their length), the head levels out to face the threat, a hood spreads and/or
 * the mouth gapes, then it sinks back down. o: { segments (head first), raise (how many
 * body segments lift), angle, segLength, hood: [left, right], jaw, gape, length }.
 */
export function serpentThreat(o) {
  const [head, ...body] = o.segments;
  const raise = o.raise ?? 2, angle = o.angle ?? 60, len = o.segLength ?? 5, T = o.length ?? 3;
  const up = r(raise * len * Math.sin(angle * Math.PI / 180));
  const key = (v) => ({ '0.0': v.map(() => 0), '0.4': v, [r(T - 0.5).toFixed(2)]: v, [T.toFixed(1)]: v.map(() => 0) });
  return once(T, bones(
    { [body[0]]: { rotation: key([-angle, 0, 0]), position: key([0, up, 0]) } },
    { [body[raise]]: { rotation: key([angle, 0, 0]) } },
    { [head]: { rotation: key([angle - 5, 0, 0]) } },
    ...(o.hood ? [
      { [o.hood[0]]: { rotation: key([0, -10, -90]) } },
      { [o.hood[1]]: { rotation: key([0, 10, 90]) } },
    ] : []),
    o.jaw ? { [o.jaw]: { rotation: key([o.gape ?? 50, 0, 0]) } } : {},
  ));
}

/**
 * Constrictor wrapped around its prey (which stands at the snake's origin): the body
 * winds up in a rising helix ~5.5px across, the head on top looking down at the victim,
 * squeezing in slow pulses. Fitted for a chain of 5px segments starting at z=0.
 */
function coil(head, body, tongue) {
  const squeeze = (k) => cycle(1.6, 8, (p) => [-16, 55 + k * Math.max(0, sin(p)), 0]);
  return loop(1.6, bones(
    { [body[0]]: { rotation: [15.5, -68.9, -33.4], position: [0, 5.8, -5.1] } },
    Object.fromEntries(body.slice(1).map((b) => [b, { rotation: squeeze(3) }])),
    { [head]: { rotation: [-30, -100, 0] } },
    tongue ? { [tongue]: { scale: { '0.0': [1, 1, 0], '1.0': [1, 1, 0], '1.2': [1, 1, 1], '1.4': [1, 1, 0], '1.6': [1, 1, 0] } } } : {},
  ));
}

/** Eight-legged walkers: legs swing in alternating sets (L1 R2 L3 R4 vs R1 L2 R3 L4). */
export function arachnid(o) {
  const legs = o.legs; // [{ bone, side: 1|-1, index: 0..3 }]
  const n = 8;
  const swing = (len, amp) => Object.fromEntries(legs.map(({ bone, side, index }) => {
    const phase = (index + (side > 0 ? 0 : 1)) % 2 ? 0.5 : 0;
    return [bone, { rotation: cycle(len, n, (p) => [0, amp * sin(p, phase), side * 8 * Math.max(0, sin(p, phase + 0.25))]) }];
  }));
  return {
    walk: loop(0.6, swing(0.6, 18)),
    run: loop(0.35, swing(0.35, 24)),
    idle: loop(4, o.fangs ? { [o.fangs]: { rotation: cycle(4, 8, (p) => [4 * Math.max(0, sin(p * 2)), 0, 0]) } } : {}),
    attack: once(0.6, bones(
      Object.fromEntries(legs.filter((l) => l.index === 0).map(({ bone, side }) => [bone, { rotation: { '0.0': [0, 0, 0], '0.2': [0, 0, side * -45], '0.6': [0, 0, 0] } }])),
      { [o.body ?? 'body']: { rotation: { '0.0': [0, 0, 0], '0.2': [-15, 0, 0], '0.6': [0, 0, 0] } } },
    )),
  };
}

/** Frogs: hop with the hind legs, puff the throat when idle. */
export function frog(o = {}) {
  const body = o.body ?? 'body';
  const ll = o.legL ?? 'leg_bl', lr = o.legR ?? 'leg_br', fl = o.armL ?? 'leg_fl', fr = o.armR ?? 'leg_fr';
  const hop = (len, h) => ({
    [body]: { position: { '0.00': [0, 0, 0], [(len * 0.4).toFixed(2)]: [0, h, 0], [len.toFixed(2)]: [0, 0, 0] }, rotation: { '0.00': [0, 0, 0], [(len * 0.3).toFixed(2)]: [-15, 0, 0], [len.toFixed(2)]: [0, 0, 0] } },
    [ll]: { rotation: { '0.00': [0, 0, 0], [(len * 0.3).toFixed(2)]: [60, 0, 0], [len.toFixed(2)]: [0, 0, 0] } },
    [lr]: { rotation: { '0.00': [0, 0, 0], [(len * 0.3).toFixed(2)]: [60, 0, 0], [len.toFixed(2)]: [0, 0, 0] } },
    [fl]: { rotation: { '0.00': [0, 0, 0], [(len * 0.5).toFixed(2)]: [-30, 0, 0], [len.toFixed(2)]: [0, 0, 0] } },
    [fr]: { rotation: { '0.00': [0, 0, 0], [(len * 0.5).toFixed(2)]: [-30, 0, 0], [len.toFixed(2)]: [0, 0, 0] } },
  });
  return {
    walk: loop(0.5, hop(0.5, 2)),
    run: loop(0.35, hop(0.35, 3)),
    idle: loop(3, o.throat ? { [o.throat]: { scale: { '0.0': [1, 1, 1], '1.0': [1, 1, 1], '1.3': [1.3, 1.4, 1.3], '1.6': [1, 1, 1], '3.0': [1, 1, 1] } } } : {}),
  };
}

/** Shelled animals: slow plod, and pull head, legs and tail into the shell. */
export function shelled(o) {
  const L = { fl: 'leg_fl', fr: 'leg_fr', bl: 'leg_bl', br: 'leg_br', ...(o.legs ?? {}) };
  const head = o.head ?? 'head', tail = o.tail;
  const n = 8;
  const plod = (len, amp) => Object.fromEntries(Object.entries(L).map(([k, bone]) => {
    const off = { fl: 0, br: 0, fr: 0.5, bl: 0.5 }[k];
    return [bone, { rotation: cycle(len, n, (p) => [amp * sin(p, off), 0, 0]) }];
  }));
  const tuck = (dz) => ({ position: [0, 0, dz] });
  return {
    walk: loop(o.walkLength ?? 2.0, bones(plod(o.walkLength ?? 2.0, 15), { [head]: { rotation: cycle(o.walkLength ?? 2.0, n, (p) => [0, 6 * sin(p), 0]) } })),
    swim: loop(1.4, plod(1.4, 35)),
    idle: loop(6, { [head]: { rotation: cycle(6, n, (p) => [3 * sin(p), 15 * sin(p, 0.3), 0]) } }),
    hide: hold(bones(
      { [head]: tuck(o.headTuck ?? 4) },
      { [L.fl]: { position: [o.legTuckX ?? -1, 1, 1] }, [L.fr]: { position: [-(o.legTuckX ?? -1), 1, 1] } },
      { [L.bl]: { position: [o.legTuckX ?? -1, 1, -1] }, [L.br]: { position: [-(o.legTuckX ?? -1), 1, -1] } },
      tail ? { [tail]: tuck(-2) } : {},
    )),
    sleep: hold(bones({ [head]: tuck(2) })),
  };
}

/** River dolphins: up-and-down fluke strokes. */
export function cetacean(o = {}) {
  const tail = o.tail ?? 'tail', fluke = o.fluke ?? 'fluke', body = o.body ?? 'body';
  const n = 8;
  const stroke = (len, amp) => bones(
    { [tail]: { rotation: cycle(len, n, (p) => [amp * sin(p), 0, 0]) } },
    { [fluke]: { rotation: cycle(len, n, (p) => [amp * 0.8 * sin(p, -0.15), 0, 0]) } },
    { [body]: { rotation: cycle(len, n, (p) => [amp * 0.15 * sin(p, 0.5), 0, 0]) } },
  );
  return {
    swim: loop(0.9, stroke(0.9, 22)),
    idle: loop(2.4, stroke(2.4, 8)),
    walk: loop(0.9, stroke(0.9, 22)),
  };
}
