import profile from "./data/potsdamerCorridorV288Profile.json";
import { buildingTerrainOffset } from "./weinbergTerrainV176";

function roofAt(triangles: readonly number[][][], x: number, z: number): number | null {
  let high = -Infinity;
  for (const [a, b, c] of triangles) {
    const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(det) < 1e-8) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
    if (Math.min(u, v, 1 - u - v) >= -1e-6) high = Math.max(high, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  return Number.isFinite(high) ? high : null;
}

/** Exact complete source footprints/court holes and roof-aware walking tops.
 * Uses the same rigid parent datum as the two rendered families. */
export function potsdamerCorridorSolidsV288() {
  return profile.navigation.map(part => {
    const parent = profile.owners.find(site => site.parent === part.parent)!;
    const offset = buildingTerrainOffset(part.parent, parent.anchor[0], parent.anchor[1], parent.sourceGround);
    return { sourceId: part.id, ring: part.ring, holes: part.holes,
      minY: part.low + offset, maxY: part.high + offset,
      low: part.low + offset, high: part.high + offset,
      topAt: (x: number, z: number): number | null => {
        const roof = roofAt(part.roofTriangles, x, z);
        return roof === null ? null : roof + offset;
      } };
  });
}
