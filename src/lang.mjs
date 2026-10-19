// In-game texts (.lang files) for every supported language.
// Danish names for animals, items, habitats and tags are shared with the
// website (src/i18n.mjs); vanilla item names follow Minecraft's own da_DK.lang.
import { guide } from './guide.mjs';
import { STRINGS } from './i18n.mjs';
import { NS } from './lib/constants.mjs';
import { BIOME_NAMES, TAGS } from './lib/info.mjs';

export const LOCALES = ['en_US', 'da_DK'];

/** Foods used for breeding and taming, keyed by item id. */
const FOODS = {
  acacia_leaves: ['Acacia Leaves', 'Akacieløv'], apple: ['Apple', 'Æble'], bamboo: ['Bamboo', 'Bambus'],
  beef: ['Raw Beef', 'Råt kød'], beetroot: ['Beetroot', 'Rødbede'], beetroot_seeds: ['Beetroot Seeds', 'Rødbedefrø'],
  birch_leaves: ['Birch Leaves', 'Birkeløv'], bone: ['Bone', 'Knogle'], carrot: ['Carrot', 'Gulerod'],
  chicken: ['Raw Chicken', 'Rå kylling'], cod: ['Raw Cod', 'Rå torsk'], glow_berries: ['Glow Berries', 'Glødebær'],
  golden_apple: ['Golden Apple', 'Gyldent æble'], golden_carrot: ['Golden Carrot', 'Gylden gulerod'],
  hay_block: ['Hay Bale', 'Halmballe'], kelp: ['Kelp', 'Tang'], melon_seeds: ['Melon Seeds', 'Melonfrø'],
  melon_slice: ['Melon Slice', 'Melonskive'], mutton: ['Raw Mutton', 'Råt fårekød'], oak_leaves: ['Oak Leaves', 'Egeløv'],
  porkchop: ['Raw Porkchop', 'Rå svinekotelet'], potato: ['Potato', 'Kartoffel'], pumpkin_seeds: ['Pumpkin Seeds', 'Græskarfrø'],
  rabbit: ['Raw Rabbit', 'Rå kanin'], rotten_flesh: ['Rotten Flesh', 'Råddent kød'], salmon: ['Raw Salmon', 'Rå laks'],
  sea_pickle: ['Sea Pickle', 'Søpølse'], short_grass: ['Short Grass', 'Kort græs'], spider_eye: ['Spider Eye', 'Edderkoppeøje'],
  sugar: ['Sugar', 'Sukker'], sugar_cane: ['Sugar Cane', 'Sukkerrør'], sweet_berries: ['Sweet Berries', 'Søde bær'],
  tropical_fish: ['Tropical Fish', 'Tropisk fisk'], wheat: ['Wheat', 'Hvede'], wheat_seeds: ['Wheat Seeds', 'Hvedefrø'],
  honeycomb: ['Honeycomb', 'Bikage'], slime_ball: ['Slimeball', 'Slimklump'], seagrass: ['Seagrass', 'Søgræs'], cactus: ['Cactus', 'Kaktus'], dandelion: ['Dandelion', 'Mælkebøtte'], brown_mushroom: ['Brown Mushroom', 'Brun svamp'], red_mushroom: ['Red Mushroom', 'Rød svamp'], lily_pad: ['Lily Pad', 'Åkandeblad'], honey_bottle: ['Honey Bottle', 'Honningflaske'], egg: ['Egg', 'Æg'],
};
export const foodKey = (item) => `${NS}.food.${item.replace(/^.*:/, '')}`;

/** Danish compound form used before "-spawnæg" (as in vanilla "Heste-spawnæg"). */
const DA_EGG = {
  white_tailed_deer: 'Hvidhalehjorte', red_deer: 'Kronhjorte', roe_deer: 'Rådyrs', moose: 'Elge', wild_boar: 'Vildsvine',
  black_bear: 'Sortbjørne', gray_wolf: 'Ulve', red_fox: 'Ræve', hare: 'Hare', pheasant: 'Fasan', mallard: 'Gråande',
  wild_turkey: 'Kalkun', hunting_dog: 'Jagthunde',
};

/** English and Danish for everything the scripts and the Java mod show. */
const UI = {
  // Hunting Journal
  'hunting.journal.title': ['Hunting Journal', 'Jagtdagbog'],
  'hunting.journal.intro': ['Your shots, your trophies and the game you have seen.', 'Dine skud, dine trofæer og det vildt, du har set.'],
  'hunting.journal.last_shot': ['Last shot', 'Seneste skud'],
  'hunting.journal.shots': ['Shot reports (%s)', 'Skudrapporter (%s)'],
  'hunting.journal.trophies': ['Trophies (%s)', 'Trofæer (%s)'],
  'hunting.journal.species': ['Game guide (%s/%s seen)', 'Vildtguide (%s/%s set)'],
  'hunting.journal.wind': ['Check the wind', 'Tjek vinden'],
  'hunting.journal.back': ['Back', 'Tilbage'],
  'hunting.journal.none': ['Nothing here yet.', 'Intet her endnu.'],
  'hunting.journal.welcome': ['§6You received a Hunting Journal!§r Your shot reports and trophies are kept in it.', '§6Du har fået en jagtdagbog!§r Dine skudrapporter og trofæer gemmes i den.'],
  'hunting.journal.spotted': ['New in your Hunting Journal: %s', 'Nyt i din jagtdagbog: %s'],
  'hunting.journal.lives_in': ['Lives in:', 'Lever i:'],
  'hunting.journal.traits': ['Traits:', 'Kendetegn:'],
  'hunting.journal.calibre': ['Calibre: at least %s J at impact', 'Kaliber: mindst %s J ved træffet'],
  'hunting.journal.senses': ['Senses: sight %s, hearing %s, smell %s', 'Sanser: syn %s, hørelse %s, lugt %s'],
  'hunting.journal.trophy_line': ['%s · score %s · %s kg · %s', '%s · point %s · %s kg · %s'],
  'hunting.journal.shot_line': ['%s · %s m · %s', '%s · %s m · %s'],
  // Shot report
  'hunting.report.title': ['Shot report: %s', 'Skudrapport: %s'],
  'hunting.report.distance': ['Distance: %s m', 'Afstand: %s m'],
  'hunting.report.weapon': ['Calibre: %s', 'Kaliber: %s'],
  'hunting.report.energy': ['Energy at impact: %s J', 'Energi ved træffet: %s J'],
  'hunting.report.accuracy': ['Accuracy: %s%%', 'Præcision: %s%%'],
  'hunting.report.entry': ['Entry: %s side', 'Indskud: %s side'],
  'hunting.report.exit': ['Exit: %s side', 'Udskud: %s side'],
  'hunting.report.no_exit': ['No exit wound', 'Intet udskud'],
  'hunting.report.organs': ['Hit:', 'Ramt:'],
  'hunting.report.blood': ['Blood: %s', 'Blod: %s'],
  'hunting.report.pellets': ['Pellets on target: %s of %s', 'Hagl i målet: %s af %s'],
  'hunting.report.outcome.kill': ['Killed on the spot.', 'Dræbt på stedet.'],
  'hunting.report.outcome.mortal': ['Mortally hit. Expect it to run about %s m before it goes down.', 'Dødeligt ramt. Regn med en flugt på omkring %s m, før det falder.'],
  'hunting.report.outcome.wound': ['Wounded. It will recover unless you follow up.', 'Anskudt. Dyret kommer sig, medmindre du eftersøger det.'],
  'hunting.report.outcome.none': ['No effect.', 'Ingen virkning.'],
  'hunting.report.outcome.miss': ['Missed.', 'Forbier.'],
  'hunting.report.note.underpowered': ['Calibre too light for this animal.', 'Kaliberet er for let til dette dyr.'],
  'hunting.report.note.meat_damage': ['Far too much gun: a lot of meat was spoiled.', 'Alt for kraftigt våben: meget kød er ødelagt.'],
  'hunting.report.recovered': ['Recovered: %s kg, trophy score %s', 'Hentet: %s kg, trofæpoint %s'],
  'hunting.report.xray': ['X-ray', 'Røntgen'],
  'hunting.report.open': ['Open your Hunting Journal for the full shot report.', 'Åbn din jagtdagbog for at se hele skudrapporten.'],
  'hunting.report.open_java': ['Press R for the full shot report.', 'Tryk på R for at se hele skudrapporten.'],
  'hunting.grade.perfect': ['Perfect shot', 'Perfekt skud'],
  'hunting.grade.good': ['Good shot', 'Godt skud'],
  'hunting.grade.poor': ['Poor shot', 'Dårligt skud'],
  'hunting.grade.unethical': ['Unethical shot', 'Uetisk skud'],
  'hunting.grade.miss': ['Miss', 'Forbier'],
  'hunting.side.left': ['left', 'venstre'],
  'hunting.side.right': ['right', 'højre'],
  'hunting.side.front': ['front', 'forreste'],
  'hunting.side.rear': ['rear', 'bageste'],
  'hunting.side.top': ['top', 'øverste'],
  'hunting.side.bottom': ['under', 'nederste'],
  'hunting.zone.brain': ['Brain', 'Hjerne'],
  'hunting.zone.spine': ['Spine', 'Rygrad'],
  'hunting.zone.heart': ['Heart', 'Hjerte'],
  'hunting.zone.lungs': ['Lungs', 'Lunger'],
  'hunting.zone.liver': ['Liver', 'Lever'],
  'hunting.zone.stomach': ['Stomach', 'Mave'],
  'hunting.zone.shoulder': ['Shoulder', 'Bov'],
  'hunting.zone.neck': ['Neck', 'Hals'],
  'hunting.zone.ham': ['Hindquarter', 'Kølle'],
  'hunting.zone.muscle': ['Muscle', 'Muskel'],
  'hunting.zone.jaw': ['Jaw', 'Kæbe'],
  'hunting.zone.leg': ['Leg', 'Ben'],
  'hunting.zone.antler': ['Antler', 'Gevir'],
  'hunting.zone.tail': ['Tail', 'Hale'],
  'hunting.blood.none': ['none', 'intet'],
  'hunting.blood.bright': ['bright red', 'lyserødt'],
  'hunting.blood.frothy': ['pink and frothy (lungs)', 'lyserødt og skummende (lunger)'],
  'hunting.blood.dark': ['dark red (liver)', 'mørkerødt (lever)'],
  'hunting.blood.gut': ['dark, with stomach contents', 'mørkt, med maveindhold'],
  'hunting.blood.little': ['a few drops', 'nogle få dråber'],
  // HUD
  'hunting.hud.scope': ['%sx · %s m · wind %s', '%sx · %s m · vind %s'],
  'hunting.hud.steady': ['§aHolding breath', '§aHolder vejret'],
  'hunting.hud.shaky': ['§cOut of breath', '§cForpustet'],
  'hunting.hud.no_ammo': ['§cNo %s', '§cIngen %s'],
  'hunting.hud.cycling': ['Working the bolt...', 'Ny patron i kammeret...'],
  'hunting.hud.state.1': ['§eAlert', '§eÅrvågen'],
  'hunting.hud.state.2': ['§6Fleeing', '§6Flygter'],
  'hunting.hud.state.3': ['§cWounded', '§cAnskudt'],
  'hunting.hud.state.4': ['§7Down', '§7Nedlagt'],
  'hunting.hud.state.0': ['§aCalm', '§aRolig'],
  'hunting.hud.binoculars': ['%s · %s m · %s', '%s · %s m · %s'],
  'hunting.hud.binoculars.none': ['%s m', '%s m'],
  'hunting.hud.buck': ['buck', 'buk'],
  'hunting.hud.doe': ['doe', 'då'],
  // Wind
  'hunting.wind.reading': ['Wind from the %s, %s m/s (%s)', 'Vind fra %s, %s m/s (%s)'],
  'hunting.wind.short': ['%s %s m/s', '%s %s m/s'],
  'hunting.wind.n': ['north', 'nord'], 'hunting.wind.ne': ['northeast', 'nordøst'], 'hunting.wind.e': ['east', 'øst'], 'hunting.wind.se': ['southeast', 'sydøst'],
  'hunting.wind.s': ['south', 'syd'], 'hunting.wind.sw': ['southwest', 'sydvest'], 'hunting.wind.w': ['west', 'vest'], 'hunting.wind.nw': ['northwest', 'nordvest'],
  'hunting.wind.arrow.n': ['N', 'N'], 'hunting.wind.arrow.ne': ['NE', 'NØ'], 'hunting.wind.arrow.e': ['E', 'Ø'], 'hunting.wind.arrow.se': ['SE', 'SØ'],
  'hunting.wind.arrow.s': ['S', 'S'], 'hunting.wind.arrow.sw': ['SW', 'SV'], 'hunting.wind.arrow.w': ['W', 'V'], 'hunting.wind.arrow.nw': ['NW', 'NV'],
  'hunting.wind.strength.0': ['calm', 'stille'], 'hunting.wind.strength.1': ['light air', 'næsten stille'], 'hunting.wind.strength.2': ['light breeze', 'svag vind'],
  'hunting.wind.strength.3': ['gentle breeze', 'let vind'], 'hunting.wind.strength.4': ['moderate breeze', 'jævn vind'], 'hunting.wind.strength.5': ['fresh breeze', 'frisk vind'],
  // Gear
  'hunting.scent.applied': ['Scent eliminator applied: game can hardly smell you for 5 minutes.', 'Duftfjerner påført: Vildtet kan næsten ikke lugte dig i 5 minutter.'],
  'hunting.scent.worn_off': ['Your scent eliminator has worn off.', 'Din duftfjerner virker ikke længere.'],
  'hunting.call.used': ['You blow the %s. Anything nearby that answers to it will come closer.', 'Du blæser i %s. Dyr i nærheden, der reagerer på den, kommer nærmere.'],
  'hunting.dress.need_knife': ['You need a hunting knife to field dress this animal.', 'Du skal bruge en jagtkniv for at brække dette dyr.'],
  'hunting.dress.done': ['Field dressed: %s', 'Brækket: %s'],
  'hunting.trophy.new': ['§6New trophy!§r %s, score %s', '§6Nyt trofæ!§r %s, %s point'],
  'hunting.carcass.near': ['A %s lies here. Use a hunting knife on it.', 'Her ligger en %s. Brug en jagtkniv på den.'],
  // Dog
  'hunting.dog.tracking': ['Your dog picks up the trail!', 'Din hund fanger sporet!'],
  'hunting.dog.no_trail': ['Your dog finds no fresh trail.', 'Din hund finder intet friskt spor.'],
  'hunting.dog.found': ['Your dog has found the %s!', 'Din hund har fundet %s!'],
  'hunting.dog.no_dog': ['No tame hunting dog of yours is close enough to hear the whistle.', 'Ingen af dine tamme jagthunde er tæt nok på til at høre fløjten.'],
  'action.interact.hunting.field_dress': ['Field dress', 'Bræk'],
  // Java key bindings
  'key.category.hunting.hunting': ['Realistic Hunting', 'Realistisk jagt'],
  'key.hunting.report': ['Last shot report', 'Seneste skudrapport'],
  'key.hunting.zoom': ['Scope zoom', 'Kikkertsigtets zoom'],
};

/**
 * Lang entries for one locale as [key, value] pairs.
 * animals/items/blocks/helpers come from the build; `description` is the pack description.
 */
export function langEntries(locale, { animals, items, blocks, extraEntities, description, version }) {
  const i = LOCALES.indexOf(locale);
  const da = locale === 'da_DK' ? STRINGS.da : null;
  const pick = (pair) => pair[Math.max(0, i)];
  const out = [];
  out.push(['pack.description', da
    ? `Realistisk jagt: hjorte, elge, vildsvin, bjørne og vildtfugle, der ser, hører og lugter dig, rifler med kikkertsigte og en skudrapport med røntgenbillede (v${version})`
    : `${description} (v${version})`]);

  for (const a of animals) {
    const name = da?.names[a.id] ?? a.name;
    out.push([`entity.${NS}:${a.id}.name`, name]);
    out.push([`item.spawn_egg.entity.${NS}:${a.id}.name`, da ? `${DA_EGG[a.id] ?? name}-spawnæg` : `${a.name} Spawn Egg`]);
    out.push([`${NS}.guide.entry.${a.id}`, da?.guide[a.id] ?? guide[a.id] ?? '']);
  }
  for (const e of extraEntities) {
    out.push([`entity.${NS}:${e.id}.name`, da?.items[e.id] ?? e.name]);
    out.push([`item.spawn_egg.entity.${NS}:${e.id}.name`, e.name]);
  }
  for (const item of items) out.push([`item.${NS}:${item.id}.name`, da?.items[item.id] ?? item.name]);
  for (const block of blocks) out.push([`tile.${NS}:${block.id}.name`, da?.items[block.id] ?? block.name]);

  for (const [id, name] of Object.entries(BIOME_NAMES)) out.push([`${NS}.habitat.${id}`, da?.habitats[name] ?? name]);
  for (const [id, name] of Object.entries(TAGS)) out.push([`${NS}.tag.${id}`, da?.tags[name] ?? name]);
  for (const [item, pair] of Object.entries(FOODS)) out.push([foodKey(item), pick(pair)]);
  for (const [key, pair] of Object.entries(UI)) out.push([key, pick(pair)]);
  return out;
}

/** Every breed/tame food must have a translation. */
export function missingFoods(animals) {
  const used = new Set(animals.flatMap((a) => [...(a.breed ?? []), ...(a.ride?.tameItems ?? [])]));
  return [...used].filter((item) => !FOODS[item]);
}
