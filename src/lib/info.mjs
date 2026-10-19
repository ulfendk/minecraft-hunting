// Facts derived from animal specs, shared by the website, the lang files and
// the Field Guide script (which shows them through translation keys).
import { guide } from '../guide.mjs';

export const BIOME_NAMES = {
  savanna: 'Savanna', jungle: 'Jungle', desert: 'Desert', swamp: 'Swamp', mangrove: 'Mangrove swamp',
  river: 'Rivers', beach: 'Beaches', mesa: 'Badlands', plains: 'Plains', forest: 'Forest', taiga: 'Taiga', mountains: 'Mountains',
  ocean: 'Oceans', deep_ocean: 'Deep oceans', lukewarm_ocean: 'Warm oceans', cold_ocean: 'Cold oceans',
};

export const TAGS = {
  rideable: 'Rideable', rideable_chests: 'Rideable · carries chests', hunter: 'Hunter', prey: 'Prey',
  dangerous: 'Dangerous', fights_back: 'Fights back', nocturnal: 'Active at night', flies: 'Flies',
  swims: 'Swims', climbs: 'Climbs', gentle: 'Gentle', companion: 'Companion',
  small_game: 'Small game', medium_game: 'Medium game', big_game: 'Big game', dangerous_game: 'Dangerous game',
};

export function habitatIds(a) {
  return [...new Set((a.spawn ?? []).flatMap((s) => s.biomes))];
}

export function habitats(a) {
  return habitatIds(a).map((b) => BIOME_NAMES[b] ?? b);
}

export function tagIds(a) {
  const t = [];
  if (a.game) t.push(`${a.game.class}_game`);
  if (a.companion) t.push('companion');
  if (a.ride) t.push(a.ride.chest ? 'rideable_chests' : 'rideable');
  if (a.hunts?.length) t.push('hunter');
  if (a.fleesFrom?.length && !a.attack) t.push('prey');
  if (a.hostile) t.push('dangerous');
  else if (a.attack) t.push('fights_back');
  if (a.sleeps === 'day') t.push('nocturnal');
  if (a.movement === 'fly') t.push('flies');
  if (a.movement === 'amphibious' || a.movement === 'swim' || a.movement === 'dolphin') t.push('swims');
  if (a.climbs) t.push('climbs');
  if (!a.attack && !a.fleesFrom?.length && !a.game && !a.companion) t.push('gentle');
  return t;
}

export function tags(a) {
  return tagIds(a).map((id) => TAGS[id]);
}

/** Compact record for the in-game Field Guide script (texts come from lang keys). */
export function guideEntry(a) {
  return {
    id: a.id,
    name: a.name,
    text: guide[a.id] ?? '',
    habitats: habitatIds(a),
    tags: tagIds(a),
    food: (a.breed ?? []).map((i) => i.replace(/^.*:/, '')),
    tame: a.ride ? (a.ride.tameItems ?? []).map((i) => i.replace(/^.*:/, '')) : [],
  };
}
