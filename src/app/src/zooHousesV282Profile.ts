import data from './data/zooHousesV282.json';
import type { TiergartenWerkhofSolidV275 } from './tiergartenWerkhofV275Profile';

export function penguinRoofAtV282(triangles: readonly number[][][], x: number, z: number): number | null {
  let roof: number | null = null;
  for (const [a, b, c] of triangles) {
    const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(det) < 1e-9) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
    if (Math.min(u, v, 1 - u - v) >= -1e-6)
      roof = Math.max(roof ?? -Infinity, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  return roof;
}

/** Native walking follows actual occupied surface cells; drawn keeps full roofs. */
export function zooHouseSolidsV282(native = false): TiergartenWerkhofSolidV275[] {
  return data.penguin.parts.map(p => {
    const cells = native ? new Map(p.nativeCells.map(([x, z, y]) => [`${x}:${z}`, y])) : null;
    const [x0, z0, x1, z1] = p.nativeBounds;
    return { sourceId: p.sourceId, ring: native ? [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] : p.ring,
      holes: native ? [] : p.holes, minY: native ? Math.floor(p.minY) : p.minY,
      maxY: native ? Math.max(...p.nativeCells.map(c => c[2])) : p.maxY,
      topAt: (x, z) => cells ? cells.get(`${Math.floor(x)}:${Math.floor(z)}`) ?? null : penguinRoofAtV282(p.roofTriangles, x, z) };
  });
}
