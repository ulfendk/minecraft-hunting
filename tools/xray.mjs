// X-ray images for the shot report: the animal seen from its left side (facing right),
// a translucent silhouette with the organs drawn in. One plain image per species plus
// one per zone with that zone lit up (Bedrock shows these; Java draws the exact bullet
// path on top using the view parameters returned by xrayView).
import { PNG } from 'pngjs';
import { applyM, boneMatrices, defaultZone } from '../src/lib/hitmodel.mjs';
import { hex, mix } from '../src/lib/texture.mjs';
import { ZONES, ZONE_PRIORITY } from '../src/zones.mjs';

export const XRAY_W = 256, XRAY_H = 128;
const BG = [10, 20, 32, 215], GRID = [24, 44, 64, 255], SKIN = [120, 170, 210, 130], EDGE = [170, 215, 245, 255];

function corners(o, s) {
  return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [o[0] + (i & 1 ? s[0] : 0), o[1] + (i & 2 ? s[1] : 0), o[2] + (i & 4 ? s[2] : 0)]);
}

function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function inPoly(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Projected outlines (model space -> side view) of every hit cube and organ. */
function shapes(a) {
  const world = boneMatrices(a.model.bones);
  const project = (m, o, s) => hull(corners(o, s).map((c) => applyM(m, c)).map(([, y, z]) => [-z, y]));
  const cubes = [];
  for (const bone of a.model.bones) {
    if (bone.noHit) continue;
    for (const c of bone.cubes ?? []) if (!c.noHit) cubes.push(project(world[bone.name], c.origin, c.size));
  }
  const organs = (a.organs ?? []).map((o) => ({ zone: o.zone, poly: project(world[o.bone], o.origin, o.size) }));
  return { cubes, organs };
}

/** Screen mapping: screen = (u * scale + ox, oy - v * scale) for side-view coords (u = -z, v = y). */
export function xrayView(a) {
  const { cubes } = shapes(a);
  let min = [Infinity, Infinity], max = [-Infinity, -Infinity];
  for (const poly of cubes) for (const [u, v] of poly) {
    min = [Math.min(min[0], u), Math.min(min[1], v)];
    max = [Math.max(max[0], u), Math.max(max[1], v)];
  }
  const scale = Math.min((XRAY_W - 24) / (max[0] - min[0]), (XRAY_H - 20) / (max[1] - min[1]));
  const ox = XRAY_W / 2 - ((min[0] + max[0]) / 2) * scale;
  const oy = XRAY_H / 2 + ((min[1] + max[1]) / 2) * scale;
  return { scale: Math.round(scale * 1000) / 1000, ox: Math.round(ox * 100) / 100, oy: Math.round(oy * 100) / 100, w: XRAY_W, h: XRAY_H };
}

/** Render the x-ray PNG; `highlight` is a zone id or null. */
export function xray(a, highlight = null) {
  const { cubes, organs } = shapes(a);
  const view = xrayView(a);
  const toScreen = (poly) => poly.map(([u, v]) => [u * view.scale + view.ox, view.oy - v * view.scale]);
  const png = new PNG({ width: XRAY_W, height: XRAY_H });
  const px = (x, y) => (y * XRAY_W + x) * 4;
  for (let y = 0; y < XRAY_H; y++) for (let x = 0; x < XRAY_W; x++) {
    png.data.set((x % 16 === 0 || y % 16 === 0) ? GRID : BG, px(x, y));
  }
  const blend = (x, y, c) => {
    const k = px(x, y);
    const under = [png.data[k], png.data[k + 1], png.data[k + 2], 255];
    const out = mix(under, [c[0], c[1], c[2], 255], c[3] / 255);
    png.data.set([out[0], out[1], out[2], 230], k);
  };
  const fill = (poly, c) => {
    const s = toScreen(poly);
    const xs = s.map((p) => p[0]), ys = s.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(XRAY_H - 1, Math.ceil(Math.max(...ys))); y++)
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(XRAY_W - 1, Math.ceil(Math.max(...xs))); x++)
        if (inPoly(s, x + 0.5, y + 0.5)) c(x, y);
  };
  // Silhouette: fill every cube once (a mask), then outline the mask's edge.
  const mask = new Uint8Array(XRAY_W * XRAY_H);
  for (const poly of cubes) fill(poly, (x, y) => { mask[y * XRAY_W + x] = 1; });
  for (let y = 0; y < XRAY_H; y++) for (let x = 0; x < XRAY_W; x++) {
    if (!mask[y * XRAY_W + x]) continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !mask[(y + dy) * XRAY_W + x + dx]);
    if (edge) png.data.set(EDGE, px(x, y));
    else blend(x, y, SKIN);
  }
  // Organs, lowest priority first so the vital ones end up on top.
  const order = [...organs].sort((p, q) => ZONE_PRIORITY.indexOf(q.zone) - ZONE_PRIORITY.indexOf(p.zone));
  for (const o of order) {
    const base = hex(ZONES[o.zone].color);
    const lit = highlight === o.zone;
    const alpha = highlight ? (lit ? 255 : 70) : 170;
    fill(o.poly, (x, y) => blend(x, y, [...(lit ? mix(base, [255, 255, 255, 255], 0.25) : base).slice(0, 3), alpha]));
  }
  // A lit leg/neck/jaw/antler zone has no organ box: light up those cubes instead.
  if (highlight && !organs.some((o) => o.zone === highlight)) {
    const world = boneMatrices(a.model.bones);
    for (const bone of a.model.bones) for (const c of bone.cubes ?? []) {
      if ((c.zone ?? bone.zone ?? defaultZone(bone.name)) !== highlight) continue;
      const poly = hull(corners(c.origin, c.size).map((p) => applyM(world[bone.name], p)).map(([, y, z]) => [-z, y]));
      fill(poly, (x, y) => blend(x, y, [...hex(ZONES[highlight].color).slice(0, 3), 200]));
    }
  }
  return PNG.sync.write(png);
}

