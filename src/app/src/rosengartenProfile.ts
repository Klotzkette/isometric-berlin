import source from "./rosengartenSource.json";

export const ROSENGARTEN_PROFILE = source;
export const ROSENGARTEN_PERGOLA_PRISM_ID = source.pergola.sourcePrism.id;
const columns = source.pergola.sourceVoxelColumns;
const columnBounds = {
  minX: Math.min(...columns.map(([x]) => x)) - 0.01,
  maxX: Math.max(...columns.map(([x]) => x)) + 0.01,
  minZ: Math.min(...columns.map(([, z]) => z)) - 0.01,
  maxZ: Math.max(...columns.map(([, z]) => z)) + 0.01,
};

export function rosengartenInsideRing(x: number, z: number, ring: readonly (readonly number[])[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) &&
      x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Exact existing building-column fingerprints, never terrain/path/tree cells. */
export function rosengartenPergolaVoxelReplacementAt(
  x: number, z: number, bottomY: number, topY: number,
): boolean {
  if (x < columnBounds.minX || x > columnBounds.maxX || z < columnBounds.minZ || z > columnBounds.maxZ) return false;
  return columns.some(([cx, cz, y0, y1]) =>
    Math.abs(cx - x) < 0.01 && Math.abs(cz - z) < 0.01 &&
    Math.abs(y0 - bottomY) < 0.01 && Math.abs(y1 - topY) < 0.01);
}
