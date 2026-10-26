import { VERKEHRSKANZEL_V276_DATA as data } from './VerkehrskanzelV276Data';

export interface VerkehrskanzelSolidV276 {
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

/** The native roof uses the exact occupied cell union, never its bounding box.
 * The photograph-confirmed open canopy contribute only a roof slab and separate narrow posts. */
export function verkehrskanzelSolidsV276(native = false): VerkehrskanzelSolidV276[] {
  const result = data.parts.flatMap(part => {
    const columns = native ? new Map(part.nativeCells.map(([x, z, top]) => [`${x}:${z}`, top])) : null;
    const topAt = (x: number, z: number) => columns
      ? columns.get(`${Math.floor(x)}:${Math.floor(z)}`) ?? null
      : triangleRoof(part.roofTriangles, x, z);
    const roof: VerkehrskanzelSolidV276 = {
      sourceId: part.sourceId,
      ring: native ? part.nativeRing : part.ring,
      holes: native ? part.nativeHoles : part.holes,
      minY: part.openCanopy ? Math.min(...part.nativeCells.map(cell => cell[2])) - .20 : part.minY,
      maxY: native ? Math.max(...part.nativeCells.map(cell => cell[2])) : part.maxY,
      topAt,
      bottomAt: part.openCanopy ? (x, z) => { const top = topAt(x, z); return top === null ? part.minY : top - (native ? .20 : .18); } : undefined,
    };
    return [roof];
  });
  const boxSolid = ([x, y, z, w, h, d]: number[]): VerkehrskanzelSolidV276 => ({
    sourceId: '09164073', ring: [[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]], holes: [], minY: y-h/2, maxY: y+h/2,
    topAt: (px,pz) => Math.abs(px-x)<=w/2 && Math.abs(pz-z)<=d/2 ? y+h/2 : null,
  });
  result.push(...data.posts.map(boxSolid));
  if (native) result.push(...data.nativeCabinBoxes.map(boxSolid));
  else result.push({sourceId: '09164073', ring: data.cabin.ring, holes: [], minY: data.cabin.minY, maxY: data.cabin.maxY, topAt: () => data.cabin.maxY});
  return result;
}
