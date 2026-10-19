// Ghillie suit armour layers (64x32, the vanilla armour layout): leafy camouflage all over,
// with a ragged fringe of leaves on the hood's outer layer.
import { PNG } from 'pngjs';
import { fbm, hex, mix } from './texture.mjs';

const GREENS = ['#3a4a22', '#4a5a2a', '#5a6a32', '#6a6a3a', '#4a3a22'].map(hex);

export function armorLayer(layer) {
  const png = new PNG({ width: 64, height: 32 });
  png.data.fill(0);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
    const n = fbm(x / 5, y / 5, layer, 17);
    const k = Math.min(GREENS.length - 1, Math.floor(n * GREENS.length * 1.3) % GREENS.length);
    let c = GREENS[k];
    if (fbm(x / 2, y / 2, layer + 9, 5) > 0.62) c = mix(c, hex('#8a8a4a'), 0.5);
    const hatOverlay = layer === 1 && x >= 32 && y < 16;
    if (hatOverlay && fbm(x / 2, y / 2, 3, 23) < 0.55) continue; // ragged fringe
    png.data.set(c, (y * 64 + x) * 4);
  }
  return PNG.sync.write(png);
}
