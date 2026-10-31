import source from './data/berlinKlosterruineV288.json';

type V2 = [number, number];
type Hole = { centre: number; width: number; low: number; spring: number; apex: number };
type Wall = { id: string; a: V2; b: V2; top: number; holes: Hole[]; broken?: boolean };
type Member = { row: number[]; wall: string };
const FLOOR = 5.823, BRICK = 0x9f6049, JOINT = 0x754f40, CAP = 0x73665a;
const opening = (centre: number, width: number, low: number, spring: number, apex: number): Hole => ({ centre, width, low, spring, apex });
const length = (a: V2, b: V2) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const northA: V2 = [2765.896, 115.38], northB: V2 = [2795.004, 103.92];
const northLength = length(northA, northB);
/** Only extant masonry: LDA plan source-ring runs and reference photographs.
 * All heights, opening subdivisions and small setbacks are photo estimates.
 * The destroyed southern nave arcade, roof, spire and west towers are absent. */
export const BERLIN_KLOSTERRUINE_V288_WALLS: Wall[] = [
  { id: 'north-nave-arcade', a: northA, b: northB, top: 21.0,
    holes: Array.from({ length: 4 }, (_, i) => [opening((i + .5) * northLength / 4, 5.85, FLOOR, 11.4, 15.8), opening((i + .5) * northLength / 4, 1.55, 17.15, 18.75, 19.7)]).flat() },
  { id: 'west-portal-gable', a: [2765.896, 115.38], b: [2770.201, 126.116], top: 24.5, broken: true,
    holes: [opening(5.78, 4.0, FLOOR, 9.2, 12.0), opening(5.78, 2.65, 13.3, 19.1, 21.0)] },
];
const choir: V2[] = [[2795.004, 103.92], [2801.134, 101.477], [2807.233, 99.312], [2810.794, 96.893], [2814.492, 96.408], [2817.803, 98.686], [2819.533, 102.381], [2819.138, 106.668], [2816.359, 109.485], [2812.35, 110.191], [2805.606, 112.775], [2799.553, 115.219]];
for (let i = 0; i < choir.length - 1; i++) {
  const a = choir[i], b = choir[i + 1], l = length(a, b);
  BERLIN_KLOSTERRUINE_V288_WALLS.push({ id: `choir-${i}`, a, b, top: 22.15,
    holes: [opening(l / 2, l * (l > 5 ? .57 : .65), 8.75, 18.6, 21.2)] });
}

function topAt(w: Wall, u: number): number {
  if (!w.broken) return w.top;
  const l = length(w.a, w.b);
  // Existing blunt, broken west gable; never restore its missing apex.
  const f = u / l;
  return f < .16 || f > .89 ? 20.7 : f < .34 ? 20.7 + (f - .16) / .18 * 3.8 : f < .71 ? 24.5 : 21.5;
}
function halfHole(h: Hole, y: number): number {
  if (y < h.low || y >= h.apex) return 0;
  if (y <= h.spring) return h.width / 2;
  // Two-centred Gothic arch approximated by a continuous pointed envelope.
  const t = (y - h.spring) / (h.apex - h.spring);
  return h.width / 2 * Math.sqrt(Math.max(0, 1 - t)) * (1 - .28 * t);
}
function opaqueIntervals(w: Wall, low: number, high: number): V2[] {
  let intervals: V2[] = [[0, length(w.a, w.b)]];
  for (const h of w.holes) {
    if (high <= h.low || low >= h.apex) continue;
    const radius = Math.max(halfHole(h, Math.max(low, h.low)), halfHole(h, Math.min(high, h.apex - 1e-8)));
    const a = h.centre - radius, b = h.centre + radius;
    intervals = intervals.flatMap(([p, q]) => b <= p || a >= q ? [[p, q]] : [[p, Math.max(p, a)], [Math.min(q, b), q]]).filter(([p, q]) => q - p > .035) as V2[];
  }
  return intervals;
}
function drawnMembers(): Member[] {
  const result: Member[] = [];
  for (const wall of BERLIN_KLOSTERRUINE_V288_WALLS) {
    const l = length(wall.a, wall.b), ux = (wall.b[0] - wall.a[0]) / l, uz = (wall.b[1] - wall.a[1]) / l;
    // Wall sits just inside the measured footprint, keeping the complete old
    // sloped northern aisle sheets visible on its exterior side.
    const inset = wall.id === 'north-nave-arcade' ? .58 : wall.broken ? -.38 : .38;
    const nx = -uz, nz = ux;
    for (let y = FLOOR; y < wall.top - .01; y += .34) {
      const high = Math.min(wall.top, y + .34);
      for (const [a, b] of opaqueIntervals(wall, y, high)) {
        // Gable profile is clipped in short strips; all other wall strips merge.
        const cuts = wall.broken ? Math.ceil((b - a) / .65) : 1;
        for (let i = 0; i < cuts; i++) {
          const p = a + (b - a) * i / cuts, q = a + (b - a) * (i + 1) / cuts;
          const top = Math.min(high, topAt(wall, (p + q) / 2)); if (top <= y + .01) continue;
          const u = (p + q) / 2;
          result.push({ wall: wall.id, row: [wall.a[0] + ux * u + nx * inset, (y + top) / 2, wall.a[1] + uz * u + nz * inset,
            q - p, top - y - .012, .72, -Math.atan2(uz, ux), Math.round(y / .34) % 5 === 0 ? 0x975b45 : BRICK] });
        }
      }
    }
    // Caps only on extant horizontal walls, never span the church interior.
    if (!wall.broken) result.push({ wall: wall.id, row: [(wall.a[0] + wall.b[0]) / 2 + nx * inset, wall.top + .025, (wall.a[1] + wall.b[1]) / 2 + nz * inset, l, .09, .84, -Math.atan2(uz, ux), CAP] });
    // Fine horizontal sill and masonry articulation; no opaque window infill.
    for (const h of wall.holes.filter(h => h.low > 8)) {
      const x = wall.a[0] + ux * h.centre + nx * inset, z = wall.a[1] + uz * h.centre + nz * inset;
      result.push({ wall: wall.id, row: [x, h.low - .07, z, h.width + .3, .14, .87, -Math.atan2(uz, ux), JOINT] });
      if (wall.id.startsWith('choir') || wall.id.startsWith('west')) {
        // Surviving very thin tracery bars leave genuinely open sky between.
        result.push({ wall: wall.id, row: [x, (h.low + h.spring) / 2, z, .09, h.spring - h.low, .12, -Math.atan2(uz, ux), 0xb49c80] });
      }
    }
  }
  return result;
}
function sourceTop(x0: number, z0: number, x1: number, z1: number): number {
  let top = source.nativeFloorY;
  for (const [x, z, y] of source.sourceTops) if (x0 < x + 2 - 1e-6 && x1 > x + 1e-6 && z0 < z + 2 - 1e-6 && z1 > z + 1e-6) top = Math.max(top, y);
  return top;
}
function nativeMembers(): Member[] {
  const result: Member[] = [], used = new Set<string>(), pitch = .8, half = .4, floorShift = source.nativeFloorY + .025 - FLOOR;
  for (const wall of BERLIN_KLOSTERRUINE_V288_WALLS) {
    const l = length(wall.a, wall.b), ux = (wall.b[0] - wall.a[0]) / l, uz = (wall.b[1] - wall.a[1]) / l, nx = -uz, nz = ux;
    const inset = wall.id === 'north-nave-arcade' ? 1.55 : wall.broken ? -.7 : .7;
    const a: V2 = [wall.a[0] + nx * inset, wall.a[1] + nz * inset], b: V2 = [wall.b[0] + nx * inset, wall.b[1] + nz * inset];
    for (let x = Math.floor((Math.min(a[0], b[0]) - 1) / pitch) * pitch + half; x < Math.max(a[0], b[0]) + 1; x += pitch) for (let z = Math.floor((Math.min(a[1], b[1]) - 1) / pitch) * pitch + half; z < Math.max(a[1], b[1]) + 1; z += pitch) {
      const u = (x - a[0]) * ux + (z - a[1]) * uz, distance = Math.abs((x - a[0]) * nx + (z - a[1]) * nz);
      if (u < 0 || u > l || distance > .42) continue;
      const base = sourceTop(x - half, z - half, x + half, z + half) + .025;
      const holes = wall.holes.map(h => ({ ...h, low: h.low + floorShift, spring: h.spring + floorShift, apex: h.apex + floorShift }));
      const top = topAt(wall, u) + floorShift;
      let runLow: number | null = null, runHigh = 0;
      const flush = () => { if (runLow !== null && runHigh > runLow + .01) {
        const key = [x.toFixed(3), z.toFixed(3), runLow.toFixed(3), runHigh.toFixed(3)].join('/');
        if (!used.has(key)) { used.add(key); result.push({ wall: wall.id, row: [x, (runLow + runHigh) / 2, z, pitch, runHigh - runLow, pitch, 0, BRICK] }); }
      } runLow = null; };
      for (let y = source.nativeFloorY + .025; y < top; y += .5) {
        const high = Math.min(top, y + .5);
        const clear = y >= base - 1e-6 && !holes.some(h => high > h.low && y < h.apex && Math.abs(u - h.centre) < halfHole(h, Math.max(y, h.low)) + .55);
        if (clear) { runLow ??= y; runHigh = high; } else flush();
      }
      flush();
    }
  }
  return result;
}

/** Appended to the existing shared justice batches. Native has no rotated boxes. */
export function berlinKlosterruineRowsV288(native = false): number[][] {
  return (native ? nativeMembers() : drawnMembers()).map(({ row: r }) => native ? [...r.slice(0, 6), r[7]] : r);
}
/** Small navigation rectangles for the real opaque additions; arches stay open. */
export function berlinKlosterruineSolidsV288(native = false) {
  return (native ? nativeMembers() : drawnMembers()).map(({ row: r, wall }, i) => {
    const c = Math.cos(r[6]), s = Math.sin(r[6]);
    const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dz]) => [r[0] + c * dx * r[3] / 2 + s * dz * r[5] / 2, r[2] - s * dx * r[3] / 2 + c * dz * r[5] / 2]);
    return { sourceId: `klosterruine-v288-${wall}-${i}`, ring, holes: [] as number[][][], minY: r[1] - r[4] / 2, maxY: r[1] + r[4] / 2 };
  });
}
