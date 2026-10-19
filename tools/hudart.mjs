// Scope overlays for the Bedrock HUD. The texture fills the screen height, so it spans the
// vertical field of view; holdover marks are placed at the angle each distance needs for
// that rifle's calibre at that zoom level. (Java draws the same reticle at runtime.)
import { PNG } from 'pngjs';
import { heightAt } from '../src/packs/behavior_pack/scripts/lib/ballistics.js';

export const SCOPE_SIZE = 256;
export const HOLDOVER_DISTANCES = [150, 200, 250, 300];

/** Screen offset (in texture pixels from the centre) for an angle in radians at a vertical FOV in degrees. */
export const angleToPx = (angle, fov, size = SCOPE_SIZE) => (size / 2) * (Math.tan(angle) / Math.tan(((fov / 2) * Math.PI) / 180));

export function scopeTexture(calibre, fov) {
  const N = SCOPE_SIZE, c = N / 2, R = N / 2 - 4;
  const png = new PNG({ width: N, height: N });
  const set = (x, y, rgba) => {
    if (x < 0 || y < 0 || x >= N || y >= N) return;
    png.data.set(rgba, (y * N + x) * 4);
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
    if (d > R) set(x, y, [0, 0, 0, 255]);
    else if (d > R - 2) set(x, y, [30, 30, 30, 255]);
    else if (d > R - 14) set(x, y, [0, 0, 0, Math.round(((d - (R - 14)) / 12) * 150)]); // vignette
    else set(x, y, [0, 0, 0, 0]);
  }
  const ink = [12, 12, 12, 255];
  const line = (x0, y0, x1, y1, w) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
        for (let k = 0; k < w; k++) set(x0 === x1 ? x + k - Math.floor(w / 2) : x, y0 === y1 ? y + k - Math.floor(w / 2) : y, ink);
  };
  // Duplex: thick posts from the edge, a thin cross in the middle.
  const inner = Math.round(R * 0.42);
  line(c - R, c, c - inner, c, 4); line(c + inner, c, c + R, c, 4);
  line(c, c + inner, c, c + R, 4); line(c, c - R, c, c - inner, 4);
  line(c - inner, c, c + inner, c, 1); line(c, c - inner, c, c + inner, 1);
  // Holdover ticks below the centre: longer for farther distances.
  HOLDOVER_DISTANCES.forEach((s, i) => {
    const angle = -heightAt(calibre, s) / s;
    const dy = Math.round(angleToPx(angle, fov));
    if (dy < 2 || dy > inner - 2) return;
    const half = 2 + i;
    line(c - half, c + dy, c + half, c + dy, 1);
  });
  // Windage dots either side (one per 2 m/s of crosswind at 200 m would be too fiddly: plain mil-ish dots).
  for (const k of [-2, -1, 1, 2]) set(c + k * Math.round(inner / 3), c, ink), set(c + k * Math.round(inner / 3), c + 1, ink);
  return PNG.sync.write(png);
}

/** A plain black texture for the bars beside the round scope on wide screens. */
export function black() {
  const png = new PNG({ width: 4, height: 4 });
  for (let i = 0; i < 16; i++) png.data.set([0, 0, 0, 255], i * 4);
  return PNG.sync.write(png);
}
