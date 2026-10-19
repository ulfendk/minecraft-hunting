// The Hunting Journal: last shot, every shot report, the trophy log and a guide to the game
// you've seen. Every player gets one the first time they join.
import { ItemStack, system, world } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { ANIMALS, GAME } from './data.js';
import { nameOf, wind } from './game.js';
import { windText } from './gear.js';
import { GRADE_COLOR, shotsOf, showReport, trophiesOf } from './report.js';

const SEEN = 'hunting:seen';
const GIVEN = 'hunting:journal_given';
const SPECIES = ANIMALS.filter((a) => a.game || a.companion);

function seenSet(player) {
  try {
    return new Set(JSON.parse(player.getDynamicProperty(SEEN) ?? '[]'));
  } catch {
    return new Set();
  }
}

/** Every 2 seconds: game within 16 blocks counts as seen. */
function spot() {
  for (const player of world.getPlayers()) {
    const seen = seenSet(player);
    let changed = false;
    let nearby;
    try {
      nearby = player.dimension.getEntities({ families: ['hunting'], location: player.location, maxDistance: 16 });
    } catch {
      continue;
    }
    for (const e of nearby) {
      const id = e.typeId.split(':')[1];
      if (seen.has(id) || !SPECIES.some((a) => a.id === id)) continue;
      seen.add(id);
      changed = true;
      player.onScreenDisplay.setActionBar({ rawtext: [{ translate: 'hunting.journal.spotted', with: { rawtext: [nameOf(id)] } }] });
      player.playSound('random.orb', { pitch: 1.4 });
    }
    if (changed) player.setDynamicProperty(SEEN, JSON.stringify([...seen]));
  }
}

const list = (keys) => keys.flatMap((key, i) => (i ? [{ text: ', ' }, { translate: key }] : [{ translate: key }]));
const line = (label, keys) => (keys.length ? [{ text: '\n§2' }, { translate: label }, { text: '§r ' }, ...list(keys)] : []);
const sense = (v) => (v >= 1.4 ? '●●●' : v >= 1 ? '●●○' : '●○○');

function openIndex(player) {
  const shots = shotsOf(player);
  const trophies = trophiesOf(player);
  const seen = seenSet(player);
  const last = shots[shots.length - 1];
  const form = new ActionFormData()
    .title({ translate: 'hunting.journal.title' })
    .body({ translate: 'hunting.journal.intro' });
  const actions = [];
  if (last) {
    form.button({ rawtext: [{ translate: 'hunting.journal.last_shot' }, { text: '\n' }, nameOf(last.species), { text: ` · ${GRADE_COLOR[last.grade]}` }, { translate: `hunting.grade.${last.grade}` }] },
      `textures/ui/hunting/xray/${last.species}${last.zone ? `_${last.zone}` : ''}`);
    actions.push(() => showReport(player, last, () => openIndex(player)));
  }
  form.button({ translate: 'hunting.journal.shots', with: [String(shots.length)] }, 'textures/items/spyglass');
  actions.push(() => openShots(player));
  form.button({ translate: 'hunting.journal.trophies', with: [String(trophies.length)] }, 'textures/items/hunting/trophy_antlers');
  actions.push(() => openTrophies(player));
  form.button({ translate: 'hunting.journal.species', with: [String(seen.size), String(SPECIES.length)] }, 'textures/items/hunting/hunting_journal');
  actions.push(() => openSpecies(player));
  form.button({ translate: 'hunting.journal.wind' }, 'textures/items/hunting/wind_checker');
  actions.push(() => player.onScreenDisplay.setActionBar({ rawtext: [windText(wind())] }));
  form.show(player).then((res) => {
    if (!res.canceled && res.selection !== undefined) actions[res.selection]?.();
  });
}

function openShots(player) {
  const shots = [...shotsOf(player)].reverse();
  const form = new ActionFormData().title({ translate: 'hunting.journal.shots', with: [String(shots.length)] });
  if (!shots.length) form.body({ translate: 'hunting.journal.none' });
  for (const s of shots) {
    form.button({
      rawtext: [{ translate: 'hunting.journal.shot_line', with: { rawtext: [nameOf(s.species), { text: String(s.distance) }, { rawtext: [{ text: GRADE_COLOR[s.grade] }, { translate: `hunting.grade.${s.grade}` }] }] } }],
    }, `textures/ui/hunting/${s.species}`);
  }
  form.button({ translate: 'hunting.journal.back' });
  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection < shots.length) showReport(player, shots[res.selection], () => openShots(player));
    else openIndex(player);
  });
}

function openTrophies(player) {
  const trophies = [...trophiesOf(player)].sort((a, b) => b.score - a.score);
  const form = new ActionFormData().title({ translate: 'hunting.journal.trophies', with: [String(trophies.length)] });
  const body = [];
  if (!trophies.length) body.push({ translate: 'hunting.journal.none' });
  for (const t of trophies) {
    body.push({ translate: 'hunting.journal.trophy_line', with: { rawtext: [nameOf(t.species), { text: String(t.score) }, { text: String(t.kg) }, { rawtext: [{ text: GRADE_COLOR[t.grade] ?? '' }, { translate: `hunting.grade.${t.grade}` }, { text: '§r' }] }] } }, { text: '\n' });
  }
  form.body({ rawtext: body }).button({ translate: 'hunting.journal.back' });
  form.show(player).then((res) => {
    if (!res.canceled) openIndex(player);
  });
}

function openSpecies(player) {
  const seen = seenSet(player);
  const order = [...SPECIES].sort((a, b) => GAME.indexOf(a.id) - GAME.indexOf(b.id));
  const form = new ActionFormData().title({ translate: 'hunting.journal.species', with: [String(seen.size), String(SPECIES.length)] });
  for (const a of order) {
    if (seen.has(a.id)) form.button(nameOf(a.id), `textures/ui/hunting/${a.id}`);
    else form.button('§8???');
  }
  form.button({ translate: 'hunting.journal.back' });
  form.show(player).then((res) => {
    if (res.canceled) return;
    const a = order[res.selection];
    if (!a) openIndex(player);
    else if (seen.has(a.id)) openEntry(player, a);
    else openSpecies(player);
  });
}

function openEntry(player, a) {
  const body = [
    { translate: `hunting.guide.entry.${a.id}` },
    { text: '\n' },
    ...line('hunting.journal.lives_in', a.habitats.map((h) => `hunting.habitat.${h}`)),
    ...line('hunting.journal.traits', a.tags.map((t) => `hunting.tag.${t}`)),
  ];
  if (a.game) {
    body.push({ text: '\n§2' }, { translate: 'hunting.journal.calibre', with: [String(a.game.minEnergy)] });
    body.push({ text: '\n§2' }, { translate: 'hunting.journal.senses', with: [sense(a.senses.sight), sense(a.senses.hearing), sense(a.senses.smell)] });
  }
  const form = new ActionFormData().title(nameOf(a.id)).body({ rawtext: body });
  if (a.game) form.button({ translate: 'hunting.report.xray' }, `textures/ui/hunting/xray/${a.id}`);
  form.button({ translate: 'hunting.journal.back' }, `textures/ui/hunting/${a.id}`);
  form.show(player).then((res) => {
    if (!res.canceled) openSpecies(player);
  });
}

export function setupJournal() {
  system.runInterval(spot, 40);
  world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
    if (itemStack?.typeId !== 'hunting:hunting_journal') return;
    source.playSound('item.book.page_turn');
    system.run(() => openIndex(source));
  });
  world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (!initialSpawn || player.getDynamicProperty(GIVEN)) return;
    player.setDynamicProperty(GIVEN, true);
    system.runTimeout(() => {
      try {
        player.getComponent('minecraft:inventory')?.container?.addItem(new ItemStack('hunting:hunting_journal', 1));
        player.sendMessage({ translate: 'hunting.journal.welcome' });
      } catch {}
    }, 60);
  });
}
