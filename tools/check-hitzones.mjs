// Sanity checks for every game animal's hit zones, run without the game:
//   node tools/check-hitzones.mjs [ids...]
// For each species: broadside and quartering shots through the heart must hit the heart
// and be lethal; a shot over the back must miss; a shot through a front leg must be a leg
// wound. Also prints the zones a .308 passes through, for eyeballing.
import { loadAnimals } from './build.mjs';
import { buildHitModel } from '../src/lib/hitmodel.mjs';
import { evaluate } from '../src/packs/behavior_pack/scripts/lib/hitzones.js';
import { CALIBRES } from '../src/weapons.mjs';
import { ZONE_PRIORITY, ZONES } from '../src/zones.mjs';

const only = process.argv.slice(2);
const animals = (await loadAnimals()).filter((a) => a.game && (!only.length || only.includes(a.id)));
const c = CALIBRES.c3006;
let failures = 0;

function centre(model, zone) {
  const o = model.organs.find((x) => x[3] === zone) ?? model.cubes.find((x) => x[3] === zone);
  if (!o) return null;
  const [m, min, max] = o;
  const q = [0, 1, 2].map((i) => (min[i] + max[i]) / 2);
  const t = [m[3], m[7], m[11]];
  const v = [q[0] - t[0], q[1] - t[1], q[2] - t[2]];
  return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];
}

for (const a of animals) {
  const model = buildHitModel(a);
  const k = a.scale ?? 1;
  const shot = (o, d, calibre = c) => evaluate({
    model, zones: ZONES, priority: ZONE_PRIORITY, o, d, energy: calibre.energy, penetration: calibre.penetration,
    cmPerPx: 6.25 * k, minEnergy: a.game.minEnergy, bigGame: a.game.class !== 'small',
  });
  const heart = centre(model, 'heart');
  const leg = centre(model, 'leg');
  const out = [];
  const check = (name, ok, r) => {
    out.push(`  ${ok ? 'ok  ' : 'FAIL'} ${name}: ${r.hit ? r.zones.map((z) => `${z.zone} ${z.percent}%`).join(', ') : 'miss'} → ${r.fate}, ${r.grade}, ${r.accuracy}%`);
    if (!ok) failures++;
  };
  const n = (v) => { const l = Math.hypot(...v); return v.map((x) => x / l); };
  let r = shot([heart[0] + 80, heart[1], heart[2]], [-1, 0, 0]);
  check('broadside heart', r.zones.some((z) => z.zone === 'heart') && ['kill', 'mortal'].includes(r.fate), r);
  r = shot([heart[0] + 60, heart[1] + 10, heart[2] - 60], n([-60, -10, 60]));
  check('quartering away → heart', r.zones.some((z) => ['heart', 'lungs', 'gills'].includes(z.zone)) && ['kill', 'mortal'].includes(r.fate), r);
  r = shot([heart[0] + 80, model.bounds[1][1] + 6, heart[2]], [-1, 0, 0]);
  check('over the back', !r.hit, r);
  if (leg) {
    r = shot([leg[0] + 80, leg[1], leg[2]], [-1, 0, 0]);
    check('front leg', r.zones[0]?.zone === 'leg', r);
  }
  const brain = centre(model, 'brain');
  if (brain) {
    r = shot([brain[0] + 80, brain[1], brain[2]], [-1, 0, 0]);
    check('brain', r.fate === 'kill', r);
  }
  console.log(`${a.id} (scale ${k}, ${model.cubes.length} cubes, ${model.organs.length} organs)\n${out.join('\n')}`);
}
if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
