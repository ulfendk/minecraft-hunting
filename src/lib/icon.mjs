// Pack icon: a white-tailed buck at dawn seen through a rifle scope, drawn at 32x32 and scaled up.
import { PNG } from 'pngjs';
import { hex, mix } from './texture.mjs';

export function packIcon(scale = 8) {
  const N = 32;
  const px = Array.from({ length: N }, () => new Array(N));
  // Dawn sky over a dark treeline and a meadow.
  const sky = [hex('#1d2a44'), hex('#5a4a6a'), hex('#d0805a'), hex('#f2c46a')];
  for (let y = 0; y < N; y++) {
    const t = y / 20;
    const c = t < 0.45 ? mix(sky[0], sky[1], t / 0.45) : t < 0.8 ? mix(sky[1], sky[2], (t - 0.45) / 0.35) : mix(sky[2], sky[3], (t - 0.8) / 0.2);
    for (let x = 0; x < N; x++) px[y][x] = c;
  }
  const trees = hex('#1a2416');
  for (let x = 0; x < N; x++) {
    const top = 15 + Math.round(2 * Math.sin(x * 1.3) + Math.sin(x * 0.4) * 1.5);
    for (let y = top; y < 21; y++) px[y][x] = trees;
  }
  for (let y = 21; y < N; y++) for (let x = 0; x < N; x++) px[y][x] = mix(hex('#4a5a2a'), hex('#2a3418'), (y - 21) / 11);
  const dark = hex('#20140c');
  const fill = (x0, y0, x1, y1, c = dark) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (y >= 0 && y < N && x >= 0 && x < N) px[y][x] = c; };
  // Buck, side on, facing left.
  fill(12, 17, 21, 20); // body
  fill(12, 21, 12, 25); fill(14, 21, 14, 25); fill(19, 21, 19, 25); fill(21, 21, 21, 25); // legs
  fill(10, 13, 12, 18); fill(8, 12, 11, 14); fill(7, 13, 7, 13); // neck and head
  fill(9, 9, 9, 11); fill(11, 9, 11, 11); fill(8, 8, 8, 9); fill(12, 8, 12, 9); fill(10, 8, 10, 8); // antlers
  fill(22, 16, 22, 17, hex('#f2efe6')); // white tail flag
  // Scope: black outside a circle, thin crosshair.
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16);
    if (d > 15) px[y][x] = hex('#0a0a0a');
    else if (d > 14.2) px[y][x] = hex('#2a2a2a');
  }
  for (let k = 3; k < 29; k++) {
    if (k < 13 || k > 18) { px[16][k] = hex('#0a0a0a'); px[k][16] = hex('#0a0a0a'); }
  }
  px[16][15] = hex('#c02020');
  const png = new PNG({ width: N * scale, height: N * scale });
  for (let y = 0; y < N * scale; y++) for (let x = 0; x < N * scale; x++) {
    png.data.set(px[Math.floor(y / scale)][Math.floor(x / scale)], (y * N * scale + x) * 4);
  }
  return PNG.sync.write(png);
}
