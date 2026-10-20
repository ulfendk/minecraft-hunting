// Sanity checks for a hunting target profile, run at build time without the game (the
// same checks Realistic Hunting runs on its own species in tools/check-hitzones.mjs):
// a broadside shot through the heart must hit the heart and grade perfect, a shot
// quartering away (from behind the animal's side) must reach the vitals, a shot over the back must miss, a shot through
// a front leg must be a leg wound and a brain shot must kill.
import { evaluate } from '../../src/packs/behavior_pack/scripts/lib/hitzones.js';
import { profileProblems } from '../../src/packs/behavior_pack/scripts/lib/protocol.js';
import { ZONE_PRIORITY, ZONES } from '../../src/zones.mjs';

/** The rifles (src/weapons.mjs) the checks shoot with: the lightest one that is ethical for the species. */
const RIFLES = [
  { name: '.243', energy: 2400, penetration: 45 },
  { name: '.308', energy: 3550, penetration: 65 },
  { name: '.30-06', energy: 3900, penetration: 75 },
  { name: '.338', energy: 5300, penetration: 100 },
];

function centre(model, zone) {
  const o = model.organs.find((x) => x[3] === zone) ?? model.cubes.find((x) => x[3] === zone);
  if (!o) return null;
  const [m, min, max] = o;
  const q = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
  const t = [m[3], m[7], m[11]];
  const v = [q[0] - t[0], q[1] - t[1], q[2] - t[2]];
  return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];
}

/** Returns { failures: [text], lines: [text] } for one profile. */
export function checkProfile(p) {
  const failures = profileProblems(p).map((x) => `${p?.id}: bad profile field ${x}`);
  const lines = [];
  if (failures.length) return { failures, lines };
  const rifle = RIFLES.find((r) => r.energy >= p.game.minEnergy) ?? RIFLES[RIFLES.length - 1];
  for (const [label, model] of [['', p.hitModel], [' (female)', p.hitModelFemale]]) {
    if (!model) continue;
    const shot = (o, d) => evaluate({
      model, zones: ZONES, priority: ZONE_PRIORITY, o, d, energy: rifle.energy, penetration: rifle.penetration,
      cmPerPx: 6.25 * (p.scale ?? 1), minEnergy: p.game.minEnergy, bigGame: p.game.class !== 'small',
    });
    const check = (name, ok, r) => {
      lines.push(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${label}: ${r.hit ? r.zones.map((z) => `${z.zone} ${z.percent}%`).join(', ') : 'miss'} → ${r.fate}, ${r.grade}, ${r.accuracy}%`);
      if (!ok) failures.push(`${p.id}: ${name}${label}`);
    };
    const n = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
    const far = Math.max(80, ...model.bounds[1].map(Math.abs), ...model.bounds[0].map(Math.abs)) + 20;
    const heart = centre(model, 'heart');
    let r = shot([heart[0] + far, heart[1], heart[2]], [-1, 0, 0]);
    check('broadside heart', r.zones.some((z) => z.zone === 'heart') && ['kill', 'mortal'].includes(r.fate) && r.grade === 'perfect', r);
    // The animal angled 30 degrees away from the hunter: from behind its left side, forward into the lungs.
    const lungs = centre(model, 'lungs') ?? centre(model, 'gills') ?? heart;
    r = shot([lungs[0] + far, lungs[1] + far / 6, lungs[2] + far * 0.58], n([-1, -1 / 6, -0.58]));
    check('quartering away', r.zones.some((z) => ['heart', 'lungs', 'gills'].includes(z.zone)) && ['kill', 'mortal'].includes(r.fate), r);
    r = shot([heart[0] + far, model.bounds[1][1] + 6, heart[2]], [-1, 0, 0]);
    check('over the back', !r.hit, r);
    const leg = centre(model, 'leg');
    if (leg) {
      r = shot([leg[0] + far, leg[1], leg[2]], [-1, 0, 0]);
      check('front leg', r.zones.some((z) => z.zone === 'leg'), r);
    }
    const brain = centre(model, 'brain');
    if (brain) {
      r = shot([brain[0] + far, brain[1], brain[2]], [-1, 0, 0]);
      check('brain', r.fate === 'kill', r);
    }
  }
  return { failures, lines };
}
