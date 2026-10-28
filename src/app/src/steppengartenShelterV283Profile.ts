import data from './data/steppengartenShelterV283.json';
import type { TiergartenWerkhofSolidV275 } from './tiergartenWerkhofV275Profile';

function triangleRoof(triangles: number[][][], x: number, z: number): number | null {
  let roof: number | null = null;
  for (const [a, b, c] of triangles) {
    const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(det) < 1e-9) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
    if (Math.min(u, v, 1 - u - v) >= -1e-6) {
      const y = u * a[1] + v * b[1] + (1 - u - v) * c[1];
      roof = roof === null ? y : Math.max(roof, y);
    }
  }
  return roof;
}


/** The open centre stays walkable: roof slab and actual walls are separate. */
export function steppengartenShelterSolidsV283(native = false): TiergartenWerkhofSolidV275[] {
  const box = (x: number, z: number, size: number, low: number, high: number): TiergartenWerkhofSolidV275 => ({
    sourceId: data.sourceId,
    ring: [[x - size / 2, z - size / 2], [x + size / 2, z - size / 2],
      [x + size / 2, z + size / 2], [x - size / 2, z + size / 2]],
    holes: [], minY: low, maxY: high,
    topAt: (px, pz) => Math.abs(px - x) <= size / 2 && Math.abs(pz - z) <= size / 2 ? high : null,
  });
  if (native) return [
    ...data.nativeRoofs.map(([x, z, top]) => box(x, z, .5, top - .25, top)),
    ...data.nativeWalls.map(([x, z]) => box(x, z, .25, data.groundY, data.groundY + 2.3)),
  ];
  const topAt = (x: number, z: number) => triangleRoof(data.roofs, x, z);
  return [{ sourceId: data.sourceId, ring: data.ring, holes: [],
    minY: data.eaveY - .16, maxY: data.ridgeY, topAt,
    bottomAt: (x, z) => (topAt(x, z) ?? data.eaveY) - .16,
  }, ...data.walls.map(wall => ({ sourceId: data.sourceId, ring: wall.ring,
    holes: [], minY: wall.minY, maxY: wall.maxY, topAt: () => wall.maxY }))];
}
