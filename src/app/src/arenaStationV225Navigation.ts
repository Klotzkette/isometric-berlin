import data from "./data/arenaStationV225Navigation.json";
import receipt from "./data/arenaStationV225Ownership.json";
import { insideRingV225, stationStructureV225, STATION_V225 } from "./arenaStationV225Structure";
import type { SurroundingNavigation } from "./SurroundingCityGeometry";

const supports = stationStructureV225();
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => equal(v, b[i]));
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(k => Object.hasOwn(y, k) && equal(x[k], y[k]));
}
/** Full-value guards; neither a name nor a loose geographic box authorizes removal. */
export function transferArenaStationNavigationV225(tile: string, nav: SurroundingNavigation): SurroundingNavigation {
  const records = receipt.navigationRecords.filter(r => r.tile === tile && r.groundY === nav.groundY);
  if (!records.length) return nav;
  const buildings = nav.buildings.filter(b => !records.some(r => r.owner === b.sourceId && equal(b, r.original)));
  return buildings.length === nav.buildings.length ? nav : { ...nav, buildings };
}
export function arenaStationV225RoofAt(x: number, z: number, native = false): number | null {
  if (x > 5275 && x < 5344 && z > 1482 && z < 1534 && insideRingV225(STATION_V225.rings[0], x, z)) return STATION_V225.roofY;
  if (x < 4790 || x > 4963 || z < 1420 || z > 1588) return null;
  let height: number | null = null;
  for (const [a, b, c] of data.roofTriangles) {
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-9) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    if (u < -.000001 || v < -.000001 || u + v > 1.000001) continue;
    const y = u * a[1] + v * b[1] + (1 - u - v) * c[1];
    height = Math.max(height ?? -Infinity, native ? Math.floor(y) + 1 : y);
  }
  return height;
}
/** A support is eligible only below (or within one small step of) the feet.
 * Descending from above lands on the represented roof; an existing hall visitor
 * stays on the concourse, and a visitor under the hall keeps ordinary terrain. */
export function arenaStationV225GroundAt(x: number, z: number, currentFootY: number, native = false): number | null {
  if (!Number.isFinite(currentFootY)) return null;
  const roof = arenaStationV225RoofAt(x, z, native);
  if (roof === null) return null;
  if (currentFootY >= roof - .45) return roof;
  if (x > 5275 && x < 5344 && z > 1482 && z < 1534 && currentFootY >= STATION_V225.concourseY - .45
    && insideRingV225(STATION_V225.rings[0], x, z)) return STATION_V225.concourseY;
  return null;
}
/** Open track level, represented supports, concourse slab and roof only.
 * This function never substitutes roof elevation for the terrain below it. */
export function arenaStationV225SolidAt(x: number, y: number, z: number, radius = 0, native = false): boolean {
  if (x > 5274 - radius && x < 5345 + radius && z > 1481 - radius && z < 1535 + radius) {
    const s = STATION_V225, f = s.frame, dx = x - f.x, dz = z - f.z;
    const u = dx * f.dx + dz * f.dz, v = -dx * f.dz + dz * f.dx;
    const inside = insideRingV225(s.rings[0], x, z);
    if (inside && ((y >= 9.96 && y <= 11.96) || (y >= 19.46 && y <= 19.96))) return true;
    for (const [px, py, pz, w, h, d] of supports) {
      if (y < py - h / 2 || y > py + h / 2) continue;
      const rx = x - px, rz = z - pz;
      if (Math.abs(rx * f.dx + rz * f.dz) <= w / 2 + radius && Math.abs(-rx * f.dz + rz * f.dx) <= d / 2 + radius) return true;
    }
    if (y >= 12.2 && y <= 19.4) {
      if (Math.abs(u) <= 28 + radius && Math.abs(Math.abs(v) - 13.8) <= .2 + radius) return true;
      if (Math.abs(Math.abs(u) - 28.1) <= .15 + radius && (Math.abs(v) >= 5.6 - radius || y >= 15.6) && Math.abs(v) <= 13.6 + radius) return true;
    }
    return false;
  }
  if (x < 4790 - radius || x > 4963 + radius || z < 1420 - radius || z > 1588 + radius) return false;
  for (const p of data.owners) {
    if (y <= p.low || y > p.high + (native ? 1 : 0)) continue;
    if (insideRingV225(p.ring, x, z) && !p.holes.some(r => insideRingV225(r, x, z))) {
      const roof = arenaStationV225RoofAt(x, z, native); if (roof !== null && y < roof) return true;
    }
    if (radius > 0) for (const ring of [p.ring, ...p.holes]) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      const px = a[0] + t * dx, pz = a[1] + t * dz;
      if (Math.hypot(x - px, z - pz) < radius) {
        const roof = arenaStationV225RoofAt(px, pz, native); if (roof !== null && y < roof) return true;
      }
    }
  }
  return false;
}
