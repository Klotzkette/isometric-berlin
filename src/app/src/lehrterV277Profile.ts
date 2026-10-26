import data from './data/lehrterV277Navigation.json';

export interface LehrterSolidV277 {
  sourceId: string;
  ring: number[][];
  holes: number[][][];
  minY: number;
  maxY: number;
  topAt: (x: number, z: number) => number | null;
  bottomAt?: (x: number, z: number) => number;
}

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

/** Independent native cells retain their occupied union and open court holes.
 * The drawn roof follows complete measured triangles plus every old-only sliver. */
export function lehrterSolidsV277(native = false): LehrterSolidV277[] {
  if (!native) return data.parts.map(part => ({
    sourceId: part.sourceId, ring: part.ring, holes: part.holes,
    minY: part.minY, maxY: part.maxY,
    topAt: (x, z) => triangleRoof(part.roofTriangles, x, z),
  }));
  const columns = new Map(data.nativeRoofs.map(([x, z, top]) => [`${Math.floor(x / 2)}:${Math.floor(z / 2)}`, top]));
  const maxY = Math.max(...data.nativeRoofs.map(p => p[2]));
  return data.nativePolygons.map((poly) => ({
    sourceId: poly.sourceId, ring: poly.ring, holes: poly.holes,
    minY: data.minY, maxY,
    topAt: (x, z) => columns.get(`${Math.floor(x / 2)}:${Math.floor(z / 2)}`) ?? null,
  }));
}
