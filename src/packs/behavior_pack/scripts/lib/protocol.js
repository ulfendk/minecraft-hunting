// Hunting target protocol, version 1. Plain JavaScript with no game imports: Realistic
// Hunting's scripts use it to receive species profiles, and add-ons that want their
// creatures to be game (Safari Animals, Prehistoric Dinosaurs...) use it to send them.
//
// A profile is one creature's game data and hit model (see README, "Hunting targets").
// On Bedrock it travels as script events: the sender splits the JSON into chunks
// "<id>|<part>|<parts>|<data>" of at most CHUNK characters (a script event message may
// not exceed 2048), and sends them on world load and again whenever it hears HELLO, so
// it doesn't matter which pack loads first.

export const PROTOCOL = 1;
export const REGISTER = 'hunting:register';
export const HELLO = 'hunting:hello';
export const CHUNK = 1900;

/** A profile as script event messages. */
export function chunks(profile) {
  const json = JSON.stringify(profile);
  const parts = Math.max(1, Math.ceil(json.length / CHUNK));
  const out = [];
  for (let i = 0; i < parts; i++) out.push(`${profile.id}|${i}|${parts}|${json.slice(i * CHUNK, (i + 1) * CHUNK)}`);
  return out;
}

/** Collects chunks and calls onProfile(profile) when one is complete. Returns the message handler. */
export function assembler(onProfile) {
  const pending = new Map();
  return (message) => {
    const m = /^([a-z0-9_.-]+:[a-z0-9_./-]+)\|(\d+)\|(\d+)\|/.exec(message);
    if (!m) return;
    const [head, id, part, parts] = m;
    const n = Number(parts);
    let p = pending.get(id);
    if (!p || p.parts.length !== n) {
      p = { parts: new Array(n).fill(null) };
      pending.set(id, p);
    }
    p.parts[Number(part)] = message.slice(head.length);
    if (p.parts.some((x) => x === null)) return;
    pending.delete(id);
    let profile;
    try {
      profile = JSON.parse(p.parts.join(''));
    } catch {
      return;
    }
    if (profileProblems(profile).length === 0) onProfile(profile);
  };
}

const isBox = (b) => Array.isArray(b) && b.length === 4 && b[0].length === 12 && b[1].length === 3 && b[2].length === 3 && typeof b[3] === 'string';
const isModel = (m) => m && Array.isArray(m.cubes) && Array.isArray(m.organs) && m.cubes.every(isBox) && m.organs.every(isBox)
  && Array.isArray(m.vital) && typeof m.vitalRadius === 'number' && Array.isArray(m.bounds);

/** What's wrong with a profile (empty when it's usable). */
export function profileProblems(p) {
  const out = [];
  if (!p || typeof p !== 'object') return ['not an object'];
  if (p.v !== PROTOCOL) out.push(`protocol ${p.v}, expected ${PROTOCOL}`);
  if (typeof p.id !== 'string' || !/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(p.id)) out.push('id');
  if (typeof p.name !== 'string') out.push('name');
  const g = p.game;
  if (!g || !['small', 'medium', 'big', 'dangerous'].includes(g.class)) out.push('game.class');
  if (!g || typeof g.minEnergy !== 'number' || !Array.isArray(g.weight) || typeof g.score !== 'number') out.push('game');
  if (!p.senses || typeof p.senses.sight !== 'number') out.push('senses');
  if (!isModel(p.hitModel)) out.push('hitModel');
  if (p.hitModelFemale && !isModel(p.hitModelFemale)) out.push('hitModelFemale');
  if (!Array.isArray(p.loot)) out.push('loot');
  return out;
}
