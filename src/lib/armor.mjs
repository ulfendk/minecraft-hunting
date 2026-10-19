// Armour layers (64x32, the vanilla armour layout), one pair per armour set:
//   ghillie   leafy camouflage all over, with a ragged fringe of leaves on the hood
//   dive      a dive mask strapped round the head, a yellow scuba tank on the back, fins
//   snorkel   the dive mask with a snorkel tube up the left side of the head
// Layout (layer 1): head 0-32 x 0-16 (right, front, left, back faces at y 8-16), hat overlay
// 32-64 x 0-16, leg/boot 0-16 x 16-32, body 16-40 x 16-32 (front 20-28, back 32-40), arm 40-56.
import { PNG } from 'pngjs';
import { fbm, hex, mix } from './texture.mjs';

const GREENS = ['#3a4a22', '#4a5a2a', '#5a6a32', '#6a6a3a', '#4a3a22'].map(hex);

function ghillie(png, layer) {
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
    const n = fbm(x / 5, y / 5, layer, 17);
    const k = Math.min(GREENS.length - 1, Math.floor(n * GREENS.length * 1.3) % GREENS.length);
    let c = GREENS[k];
    if (fbm(x / 2, y / 2, layer + 9, 5) > 0.62) c = mix(c, hex('#8a8a4a'), 0.5);
    const hatOverlay = layer === 1 && x >= 32 && y < 16;
    if (hatOverlay && fbm(x / 2, y / 2, 3, 23) < 0.55) continue; // ragged fringe
    png.data.set(c, (y * 64 + x) * 4);
  }
}

const NEOPRENE = hex('#1e2226'), TRIM = hex('#e0b020'), GLASS = hex('#8ab8d8'), GLINT = hex('#e8f4fc'), STEEL = hex('#8a8e96');

function dive(png, layer, snorkel) {
  if (layer !== 1) return; // no leggings in the dive sets
  const put = (x, y, c) => png.data.set(c, (y * 64 + x) * 4);
  const rect = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c); };
  // Mask: a strap round the head at eye level, the glass over the eyes.
  rect(0, 11, 32, 2, NEOPRENE);
  rect(8, 10, 8, 4, NEOPRENE);
  rect(9, 10, 6, 3, GLASS);
  put(10, 10, GLINT);
  put(9, 11, GLINT);
  rect(11, 13, 2, 1, NEOPRENE); // nose pocket
  if (snorkel) {
    // The tube runs up the left side of the head and over the top.
    rect(17, 8, 1, 7, TRIM);
    rect(16, 13, 3, 1, NEOPRENE);
    rect(16, 0, 1, 8, TRIM);
  }
  if (snorkel) return;
  // Scuba tank on the back, harness straps over the chest.
  rect(21, 20, 1, 12, NEOPRENE);
  rect(26, 20, 1, 12, NEOPRENE);
  rect(20, 27, 8, 1, NEOPRENE);
  rect(33, 20, 6, 12, TRIM);
  rect(34, 21, 1, 9, hex('#f4d860'));
  rect(35, 20, 2, 1, STEEL);
  rect(33, 26, 6, 1, NEOPRENE);
  // Fins over the boots: black foot pocket, yellow blade.
  rect(0, 25, 16, 7, NEOPRENE);
  rect(4, 16, 4, 4, TRIM); // the blade sticks out under the foot (bottom face)
  rect(0, 29, 16, 3, TRIM);
}

export const ARMOR_LAYER_SETS = ['ghillie', 'dive', 'snorkel'];

/** One armour layer (1 = helmet, chest, boots; 2 = leggings) for an armour set. */
export function armorLayer(set, layer) {
  const png = new PNG({ width: 64, height: 32 });
  png.data.fill(0);
  if (set === 'ghillie') ghillie(png, layer);
  else if (set === 'dive' || set === 'snorkel') dive(png, layer, set === 'snorkel');
  else throw new Error(`Unknown armour set ${set}`);
  return PNG.sync.write(png);
}
