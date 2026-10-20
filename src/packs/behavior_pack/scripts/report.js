// Shot reports: what the player sees right after a hit (action bar + x-ray flash) and the
// full report kept in the Hunting Journal.
import { system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { ZONE_PRIORITY, ZONES } from './data.js';
import { nameOf, showXray, xrayOf } from './game.js';

const MAX_SHOTS = 30;
const MAX_TROPHIES = 60;

export const GRADE_COLOR = { perfect: '§a', good: '§2', poor: '§6', unethical: '§c', miss: '§7' };

function load(player, key) {
  try {
    return JSON.parse(player.getDynamicProperty(key) ?? '[]');
  } catch {
    return [];
  }
}

function save(player, key, list, max) {
  try {
    player.setDynamicProperty(key, JSON.stringify(list.slice(-max)));
  } catch {}
}

export const shotsOf = (player) => load(player, 'hunting:shots');
export const trophiesOf = (player) => load(player, 'hunting:trophies');

/** The most important zone the shot went through (drives the x-ray highlight). */
export function primaryZone(report) {
  let best = null;
  for (const z of report.zones ?? []) if (best === null || ZONE_PRIORITY.indexOf(z.zone) < ZONE_PRIORITY.indexOf(best)) best = z.zone;
  return best;
}

/** Blood the animal leaves: from the most serious zone. */
export function bloodOf(report) {
  const z = primaryZone(report);
  return z ? ZONES[z].blood : 'none';
}

/**
 * Store a report and show the quick summary: species · grade · accuracy, and the x-ray.
 * `shot` = { species, distance, calibre (name), energy, pellets?, pelletsHit? } plus the
 * evaluate() result fields.
 */
export function recordShot(player, shot) {
  const now = system.currentTick;
  const zone = primaryZone(shot);
  const record = {
    id: Date.now() % 1e9,
    species: shot.species,
    distance: Math.round(shot.distance),
    calibre: shot.calibre,
    energy: Math.round(shot.energy),
    accuracy: shot.accuracy,
    grade: shot.grade,
    fate: shot.fate,
    bleed: shot.bleedSeconds ?? 0,
    zones: (shot.zones ?? []).map((z) => [z.zone, z.percent]),
    entrySide: shot.entrySide ?? null,
    exitSide: shot.exitSide ?? null,
    notes: shot.notes ?? [],
    pellets: shot.pellets ?? 0,
    pelletsHit: shot.pelletsHit ?? 0,
    blood: bloodOf(shot),
    zone,
  };
  const list = shotsOf(player);
  list.push(record);
  save(player, 'hunting:shots', list, MAX_SHOTS);

  if (zone) showXray(player, shot.species, zone, now, 100);
  player.onScreenDisplay.setActionBar({
    rawtext: [
      { text: '§l' }, nameOf(shot.species), { text: `§r · ${GRADE_COLOR[shot.grade]}` },
      { translate: `hunting.grade.${shot.grade}` }, { text: `§r · ${shot.accuracy}%` },
    ],
  });
  player.sendMessage({
    rawtext: [
      { text: `${GRADE_COLOR[shot.grade]}` },
      { translate: `hunting.grade.${shot.grade}` },
      { text: '§r: ' },
      nameOf(shot.species),
      { text: `, ${record.distance} m, ` },
      ...(zone ? [{ translate: `hunting.zone.${zone}` }, { text: ', ' }] : []),
      { translate: 'hunting.report.accuracy', with: [String(shot.accuracy)] },
      { text: ' §7' },
      { translate: 'hunting.report.open' },
    ],
  });
  return record;
}

/** Recovered: the weight and trophy score are added to the shot that took the animal. */
export function recordTrophy(player, trophy) {
  const list = trophiesOf(player);
  list.push(trophy);
  save(player, 'hunting:trophies', list, MAX_TROPHIES);
  if (trophy.shotId) {
    const shots = shotsOf(player);
    const s = shots.find((x) => x.id === trophy.shotId);
    if (s) {
      s.kg = trophy.kg;
      s.score = trophy.score;
      save(player, 'hunting:shots', shots, MAX_SHOTS);
    }
  }
}

const line = (...parts) => [...parts, { text: '\n' }];

/** The full report as raw text. */
export function reportBody(r) {
  const out = [];
  out.push(...line({ text: `${GRADE_COLOR[r.grade]}§l` }, { translate: `hunting.grade.${r.grade}` }, { text: '§r' }));
  out.push(...line({ translate: 'hunting.report.distance', with: [String(r.distance)] }));
  out.push(...line({ translate: 'hunting.report.weapon', with: [r.calibre] }));
  out.push(...line({ translate: 'hunting.report.energy', with: [String(r.energy)] }));
  if (r.pellets > 1) out.push(...line({ translate: 'hunting.report.pellets', with: [String(r.pelletsHit), String(r.pellets)] }));
  out.push(...line({ translate: 'hunting.report.accuracy', with: [String(r.accuracy)] }));
  if (r.zones.length) {
    out.push(...line({ text: '§l' }, { translate: 'hunting.report.organs' }, { text: '§r' }));
    for (const [zone, pct] of [...r.zones].sort((a, b) => ZONE_PRIORITY.indexOf(a[0]) - ZONE_PRIORITY.indexOf(b[0]))) {
      const vital = ZONES[zone]?.vital ? '§c' : '§7';
      out.push(...line({ text: ` ${vital}■§r ` }, { translate: `hunting.zone.${zone}` }, { text: ` ${pct}%` }));
    }
    if (r.entrySide) out.push(...line({ translate: 'hunting.report.entry', with: { rawtext: [{ translate: `hunting.side.${r.entrySide}` }] } }));
    out.push(...line(r.exitSide ? { translate: 'hunting.report.exit', with: { rawtext: [{ translate: `hunting.side.${r.exitSide}` }] } } : { translate: 'hunting.report.no_exit' }));
    out.push(...line({ translate: 'hunting.report.blood', with: { rawtext: [{ translate: `hunting.blood.${r.blood}` }] } }));
  }
  const runMetres = String(Math.round((r.bleed ?? 0) * 5));
  out.push(...line(
    { text: '§l' },
    r.fate === 'mortal' ? { translate: 'hunting.report.outcome.mortal', with: [runMetres] } : { translate: `hunting.report.outcome.${r.grade === 'miss' ? 'miss' : r.fate}` },
    { text: '§r' },
  ));
  for (const n of r.notes ?? []) if (n !== 'no_exit') out.push(...line({ text: '§6' }, { translate: `hunting.report.note.${n}` }, { text: '§r' }));
  if (r.kg) out.push(...line({ text: '§a' }, { translate: 'hunting.report.recovered', with: [String(r.kg), String(r.score ?? 0)] }));
  return { rawtext: out };
}

/** Show one report as a form, with the x-ray of the most important zone. */
export function showReport(player, r, back) {
  const icon = xrayOf(r.species, r.zone);
  const form = new ActionFormData()
    .title({ rawtext: [{ translate: 'hunting.report.title', with: { rawtext: [nameOf(r.species)] } }] })
    .body(reportBody(r))
    .button({ translate: 'hunting.report.xray' }, icon)
    .button({ translate: 'hunting.journal.back' });
  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 0 && showXray(player, r.species, r.zone, system.currentTick, 120)) return;
    back?.();
  });
}
