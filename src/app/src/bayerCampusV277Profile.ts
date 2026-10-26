import data from './data/bayerCampusV277.json';

export interface BayerCampusSolidV277 {
  sourceId: string; ring: number[][]; holes: number[][][]; minY: number; maxY: number;
  topAt: (x: number, z: number) => number | null;
  bottomAt?: (x: number, z: number) => number;
}
function inside(ring: number[][], x: number, z: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}
/** Road bridge clearance, courts and native cell union match the actual model. */
export function bayerCampusSolidsV277(native = false): BayerCampusSolidV277[] {
  if (!native) return data.parts.map(part => ({ ...part,
    topAt: (x: number, z: number) => inside(part.ring, x, z) && !part.holes.some(r => inside(r, x, z)) ? part.maxY : null,
  }));
  const cells = new Map(data.nativeCells.map(([x, z, lo, hi]) => [`${x}:${z}`, [lo, hi]]));
  const minY = Math.min(...data.nativeCells.map(c => c[2])), maxY = Math.max(...data.nativeCells.map(c => c[3]));
  const at = (x: number, z: number) => cells.get(`${Math.floor(x)}:${Math.floor(z)}`);
  return data.nativeFootprints.map(fp => ({ ...fp, sourceId: 'K0004qx3', minY, maxY,
    topAt: (x: number, z: number) => at(x, z)?.[1] ?? null,
    bottomAt: (x: number, z: number) => at(x, z)?.[0] ?? minY,
  }));
}
