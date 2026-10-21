import source from "./data/eastCinemasV260.json";
import navigation from "./data/eastCinemasV260Navigation.json";
import receipt from "./data/eastCinemasV260Ownership.json";
import type { SurroundingNavigation } from "./SurroundingCityGeometry";

const p = source.sites.international;
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => equal(v, b[i]));
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && equal(x[k], y[k]));
}
/** Exact complete-record guard: split only this owner into lower and upper solids.
 * The retained upper footprint still supplies the original roof; its lower bound
 * opens the overhang without changing ground, roads, other owners or the source. */
export function transferEastCinemasNavigationV260(tile: string, nav: SurroundingNavigation): SurroundingNavigation {
  const records = receipt.navigationRecords.filter(r => r.tile === tile);
  if (!records.length || nav.groundY !== 3) return nav;
  let changed = false;
  const buildings = nav.buildings.flatMap(b => {
    if (!records.some(r => b.sourceId === p.parent && equal(b, r.original))) return [b];
    changed = true;
    return [{ ...b, minHeight: p.soffitY - nav.groundY },
      { ...b, ring: p.lowerRing.map(([x, z]) => [x - 3072, z + 512]), holes: [], height: p.soffitY - nav.groundY }];
  });
  return changed ? { ...nav, buildings } : nav;
}
function inside(ring: number[][], x: number, z: number): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
const nativeCells = new Set(navigation.nativeShellCells.map(c => c.join(":")));
/** Independent native voxel-shell clearance; no rotated drawn approximation. */
export function eastCinemasSolidAtV260(x: number, y: number, z: number, radius = 0, native = false): boolean {
  if (x < 3473 - radius || x > 3532 + radius || z < -148 - radius || z > -84 + radius) return false;
  const samples = [[x, z], [x - radius, z], [x + radius, z], [x, z - radius], [x, z + radius]];
  for (const [sx, sz] of samples) {
    if (native && nativeCells.has(`${Math.floor(sx / 2)}:${Math.floor((y - 3) / 2)}:${Math.floor(sz / 2)}`)) return true;
    if (y >= 3 && y <= p.soffitY && inside(p.lowerRing, sx, sz)) return true;
    if (y >= p.soffitY && y <= (native ? navigation.nativeRoofY : p.sourceRoofY) && inside(p.upperRing, sx, sz)) return true;
  }
  return false;
}
/** Passage override is restricted to the exact source owner and open volume. */
export function eastCinemasWalkableInteriorV260(x: number, y: number, z: number, sourceId?: string, native = false): boolean {
  if (sourceId !== p.parent || y < 3 || y >= p.soffitY || !inside(p.upperRing, x, z)) return false;
  return !eastCinemasSolidAtV260(x, y, z, 0, native);
}
