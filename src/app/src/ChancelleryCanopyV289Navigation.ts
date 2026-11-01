import data from "./data/chancelleryCanopyV289.json";

export type CanopySolidV289 = {
  sourceId: string; ring: number[][]; minY: number; maxY: number;
  topAt?: (x: number, z: number) => number | null;
  bottomAt?: (x: number, z: number) => number;
};
export const CANOPY_THICKNESS_V289 = .065;
export const CANOPY_NATIVE_CELL_V289 = .75;

function triangles(door: boolean): number[][][] {
  return data.roofs.filter(p => (p.sourceId === "DEBE3Djn1rlNcfOH") === door).flatMap(p => {
    const points = p.rings.flat();
    return p.triangles.map(t => t.map(i => points[i]));
  });
}
const roofTriangles = triangles(false), vestibuleTriangles = triangles(true);
export function chancelleryCanopyTrianglesV289(door = false): number[][][] { return door ? vestibuleTriangles : roofTriangles; }
export function chancelleryCanopyRoofAtV289(x: number, z: number): number | null {
  let result: number | null = null;
  for (const [a, b, c] of chancelleryCanopyTrianglesV289()) {
    const det = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(det) < 1e-10) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / det;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / det;
    if (Math.min(u, v, 1 - u - v) >= -1e-7) {
      const y = u * a[1] + v * b[1] + (1 - u - v) * c[1];
      result = result === null ? y : Math.max(result, y);
    }
  }
  return result;
}
export function chancelleryCanopyMastsV289(): number[][] {
  // These two original ridge endpoints are independent supports in the photos.
  return [[-112.007, 11.581, -156.311], [-113.196, 11.581, -130.808]];
}
export function chancelleryCanopyNativeRoofV289(): number[][] {
  const rows: number[][] = [], cell = CANOPY_NATIVE_CELL_V289;
  for (let x = -126.375; x < -103; x += cell) for (let z = -164.625; z < -122; z += cell) {
    const y = chancelleryCanopyRoofAtV289(x, z);
    if (y !== null) rows.push([x, y - .12, z, cell, .24, cell]);
  }
  return rows;
}
export function chancelleryCanopySolidsV289(native = false): CanopySolidV289[] {
  const square = (x: number, z: number, size: number, low: number, high: number): CanopySolidV289 => ({
    sourceId: "K0003Umc", ring: [[x - size / 2, z - size / 2], [x + size / 2, z - size / 2], [x + size / 2, z + size / 2], [x - size / 2, z + size / 2]], minY: low, maxY: high,
  });
  const roof = native ? chancelleryCanopyNativeRoofV289().map(([x, y, z, w, h]) => square(x, z, w, y - h / 2, y + h / 2)) :
    data.roofs.filter(r => r.sourceId === "DEBE01YYK0003Umc").map(r => ({
      sourceId: "K0003Umc", ring: r.rings[0].map(p => [p[0], p[2]]),
      minY: Math.min(...r.rings.flat().map(p => p[1])) - CANOPY_THICKNESS_V289,
      maxY: Math.max(...r.rings.flat().map(p => p[1])),
      topAt: chancelleryCanopyRoofAtV289,
      bottomAt: (x: number, z: number) => (chancelleryCanopyRoofAtV289(x, z) ?? Infinity) - CANOPY_THICKNESS_V289,
    }));
  const door = data.oldPrisms.find(p => p.id === "1rlNcfOH")!;
  return [...roof, ...chancelleryCanopyMastsV289().map(([x, y, z]) => square(x, z, native ? .3 : .24, 5.15, y)),
    { sourceId: "1rlNcfOH", ring: door.ring.map(([x, z]) => [x / 10, z / 10]), minY: 5.15, maxY: 9.144 }];
}
