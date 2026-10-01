import source from "./data/moabitJusticeV166Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const MOABIT_JUSTICE_V166_PARTS = source.parts;
export const MOABIT_JUSTICE_V166_PARENT_IDS: ReadonlySet<string> = new Set(source.parentIds);
export const MOABIT_JUSTICE_V166_PRISM_IDS: ReadonlySet<string> = new Set(source.legacyPrisms.map(p => p.id));
const bounds = source.parts.map(p => ({ p, minX: Math.min(...p.ring.map(v => v[0])), maxX: Math.max(...p.ring.map(v => v[0])), minZ: Math.min(...p.ring.map(v => v[1])), maxZ: Math.max(...p.ring.map(v => v[1])) }));
const nativeRoofs = new Map(source.nativeRoofCells.map(([x, z, y]) => [`${x},${z}`, y]));
const inside = (x: number, z: number, p: {ring: number[][]; holes: number[][][]}) => pointInWorldRing(x, z, p.ring as unknown as WorldRing) && !p.holes.some(h => pointInWorldRing(x, z, h as unknown as WorldRing));

/** Exact retained roof planes; courtyard ground is never a building column. */
export function moabitJusticeV166RoofAt(x: number, z: number, minecraft = false): number | null {
  if (x < -1280 || x > -595 || z < -950 || z > -575) return null;
  if (minecraft) return nativeRoofs.get(`${Math.floor(x)},${Math.floor(z)}`) ?? null;
  if (!bounds.some(b => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && inside(x, z, b.p))) return null;
  let top: number | null = null;
  for (const [a, b, c] of source.roofTriangles) {
    const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(den) < 1e-8) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
    if (u < -1e-6 || v < -1e-6 || u + v > 1.000001) continue;
    top = Math.max(top ?? -Infinity, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  return top;
}

/** Match the displaced native envelope including its original base and height. */
export function moabitJusticeV166SourceColumn(x: number, z: number, base: number, top: number): boolean {
  if (x < -1285 || x > -590 || z < -955 || z > -570) return false;
  return source.legacyPrisms.some(p => Math.abs(base - p.y0_dm / 10) < .11 && Math.abs(top - base - Math.ceil(p.h_dm / 40) * 4) < .11 && inside(x * 10, z * 10, p));
}
