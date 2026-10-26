import { RKI_MOABIT_V277_DATA as data } from './RkiMoabitV277Data';

export interface RkiMoabitSolidV277 {
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

function inside(ring: number[][], x: number, z: number): boolean {
  let result = false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) result=!result;
  }
  return result;
}

/** The drawn roof follows complete source facets; native collisions follow actual
 * occupied columns. No bounding rectangle substitutes for the roof footprint. */
export function rkiMoabitSolidsV277(native = false): RkiMoabitSolidV277[] {
  return data.parts.flatMap(part => {
    const columns = native ? new Map(part.nativeCells.map(([x, z, top]) => [`${x}:${z}`, top])) : null;
    const x0 = Math.min(...part.nativeCells.map(c => c[0]));
    const z0 = Math.min(...part.nativeCells.map(c => c[1]));
    const x1 = Math.max(...part.nativeCells.map(c => c[0])) + 1;
    const z1 = Math.max(...part.nativeCells.map(c => c[1])) + 1;
    const roof: RkiMoabitSolidV277 = {
      sourceId: part.sourceId,
      ring: native ? [[x0,z0],[x1,z0],[x1,z1],[x0,z1]] : part.ring,
      holes: native ? [] : part.holes,
      minY: part.openCanopy ? (native ? Math.min(...part.nativeCells.map(c => c[2])) - .25 : part.roofBottom) : part.minY,
      maxY: native ? Math.max(...part.nativeCells.map(c => c[2])) : part.maxY,
      topAt: (x: number, z: number) => columns
        ? columns.get(`${Math.floor(x)}:${Math.floor(z)}`) ?? null
        : part.flatTop !== null
          ? inside(part.ring,x,z) && !part.holes.some(h=>inside(h,x,z)) ? part.flatTop : null
          : triangleRoof(part.roofTriangles, x, z),
      bottomAt: part.openCanopy ? (x,z) => {
        const top = columns ? columns.get(`${Math.floor(x)}:${Math.floor(z)}`) : triangleRoof(part.roofTriangles,x,z);
        return top === null || top === undefined ? part.roofBottom : top - (native ? .25 : .22);
      } : undefined,
    };
    const posts: RkiMoabitSolidV277[] = (native ? part.nativePosts : part.posts).map(([x,y,z,w,h,d]) => ({
      sourceId: part.sourceId,
      ring: [[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]],
      holes: [], minY: y-h/2, maxY:y+h/2,
      topAt: (px,pz) => Math.abs(px-x) <= w/2 && Math.abs(pz-z) <= d/2 ? y+h/2 : null,
    }));
    return [roof, ...posts];
  });
}
