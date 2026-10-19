import source from "./data/kulturforumPiazzettaV246.json";

/** Only this former underground-parking placeholder is replaced. */
export const KULTURFORUM_PIAZZETTA_PRISM_ID = "26444282";
export const KULTURFORUM_PIAZZETTA_V246 = source;
const minX = -378, maxX = -260, minZ = 1034, maxZ = 1155;
const nearby = (x: number, z: number) => x >= minX && x <= maxX && z >= minZ && z <= maxZ;
let previous: Map<string, readonly number[]> | undefined;
let triangles: Map<string, number[]> | undefined;
let nativeFloors: Map<string, number> | undefined;
const key = (x: number, z: number, size: number) => `${Math.floor(x / size)},${Math.floor(z / size)}`;

/** Exact prior cell receipts, not a broad height/footprint exclusion. */
export function kulturforumPiazzettaReplacementColumn(x: number, z: number, low: number, high: number): boolean {
  if (x < minX - 4 || x > maxX + 4 || z < minZ - 4 || z > maxZ + 4) return false;
  previous ??= new Map(source.previousNativeColumns.map(p => [`${p[0]},${p[1]}`, p]));
  const p = previous.get(`${x},${z}`);
  return p !== undefined && Math.abs(p[2] - low) < .001 && Math.abs(p[3] - high) < .001;
}

/** Rendering and walking use the same DGM/retained-terrain fused triangles. */
export function kulturforumPiazzettaFloorAt(x: number, z: number, minecraft = false): number | null {
  if (!nearby(x, z)) return null;
  if (minecraft) {
    if (!nativeFloors) {
      nativeFloors = new Map();
      for (const [xx, zz, width, depth, y] of source.native) {
        for (let dx = 0; dx < width; dx += 2) for (let dz = 0; dz < depth; dz += 2) nativeFloors.set(key(xx + dx, zz + dz, 2), y);
      }
    }
    return nativeFloors.get(key(x, z, 2)) ?? null;
  }
  if (!triangles) {
    triangles = new Map();
    source.triangles.forEach((ids, i) => {
      const pts = ids.map(id => source.positions[id]);
      for (let xx = Math.floor(Math.min(...pts.map(p => p[0])) / 4); xx <= Math.floor(Math.max(...pts.map(p => p[0])) / 4); xx++) {
        for (let zz = Math.floor(Math.min(...pts.map(p => p[2])) / 4); zz <= Math.floor(Math.max(...pts.map(p => p[2])) / 4); zz++) {
          const k = `${xx},${zz}`, list = triangles!.get(k) ?? [];
          list.push(i); triangles!.set(k, list);
        }
      }
    });
  }
  for (const i of triangles.get(key(x, z, 4)) ?? []) {
    const [a, b, c] = source.triangles[i].map(id => source.positions[id]);
    const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(det) < 1e-9) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
    if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) return u * a[1] + v * b[1] + (1 - u - v) * c[1];
  }
  return null;
}
