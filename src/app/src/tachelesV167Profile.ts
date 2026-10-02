import source from "./data/tachelesV167Navigation.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
export const TACHELES_V167_PRISM_IDS: ReadonlySet<string> = new Set(source.legacyPrisms.map(p => p.id));
export const TACHELES_V167_PARENT_IDS: ReadonlySet<string> = new Set(source.parents.map(p => p.id));
/** Ground obstacles exclude the verified open passage; source footprints remain in sourceParts. */
export const TACHELES_V167_PARTS = source.parts;
export const TACHELES_V167_PROFILE = Object.freeze({ parents: source.parents, sourceParts: source.sourceParts, passage: source.passage, currentUse: "Fotografiska Berlin", originalName: "Kunsthaus Tacheles", osmWays: ["940754304", "419283679"], monumentId: "09035146", currentRoof: "photo-verified low silhouette; dimensions are display estimates; all original survey polygons retained in Evidence" });
const ringContains = (x: number, z: number, ring: readonly number[][]): boolean => pointInWorldRing(x, z, ring as unknown as WorldRing);
const bounds = source.sourceParts.map(p => ({ p, x0: Math.min(...p.polygons.flatMap(p => p.ring.map(v => v[0]))), x1: Math.max(...p.polygons.flatMap(p => p.ring.map(v => v[0]))), z0: Math.min(...p.polygons.flatMap(p => p.ring.map(v => v[1]))), z1: Math.max(...p.polygons.flatMap(p => p.ring.map(v => v[1]))) }));
export function tachelesV167SourceColumn(x: number, z: number, base: number, top: number): boolean {
  if (x < 1160 || x > 1250 || z < -760 || z > -705) return false;
  return source.legacyPrisms.some(p => Math.abs(base - p.y0_dm / 10) < .11 && Math.abs(top - base - Math.ceil(p.h_dm / 40) * 4) < .11 && ringContains(x * 10, z * 10, p.ring) && !p.holes.some(h => ringContains(x * 10, z * 10, h)));
}
const nativeRoof = new Map(source.nativeRoofCells.map(([x, z, y]) => [`${x},${z}`, y]));
export function tachelesV167RoofAt(x: number, z: number, minecraft = false): number | null {
  if (minecraft) return nativeRoof.get(`${Math.floor(x)},${Math.floor(z)}`) ?? null;
  if (!bounds.some(b => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1 && b.p.polygons.some(p => ringContains(x, z, p.ring) && !p.holes.some(h => ringContains(x, z, h))))) return null;
  let roof: number | null = null;
  for (const [a, b, c] of source.roofTriangles) {
    const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(d) < 1e-8) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d;
    if (u >= -1e-6 && v >= -1e-6 && u + v <= 1.000001) { const y = u * a[1] + v * b[1] + (1 - u - v) * c[1]; roof = roof === null ? y : Math.max(roof, y); }
  }
  return roof;
}
