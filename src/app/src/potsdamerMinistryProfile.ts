import ownership from "./potsdamerMinistryOwnership.json";

export const POTSDAMER_MINISTRY_REPLACEMENT_IDS = new Set(ownership.buildings.flatMap(b => b.prismIds));
export const POTSDAMER_MINISTRY_OWNERSHIP = ownership;
const nativeCellSize = ownership.native.cellSizeM;
const safeWholeCells = new Set(ownership.native.safeWholeCells.map(([x, z]) => `${x},${z}`));

/**
 * Lower-left raster cell. Only whole original cells with no unrelated source
 * intersection may be removed. Mixed edge columns keep their exact original
 * material and height, including neighbouring parts under an overlapping plan.
 * Unknown/finer raster grids conservatively retain their original geometry.
 */
export function isPotsdamerMinistryReplacementCell(x: number, z: number, size: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(size) || size <= 0 ||
      x % nativeCellSize !== 0 || z % nativeCellSize !== 0 || size % nativeCellSize !== 0) return false;
  for (let dx = 0; dx < size; dx += nativeCellSize) {
    for (let dz = 0; dz < size; dz += nativeCellSize) {
      if (!safeWholeCells.has(`${x + dx},${z + dz}`)) return false;
    }
  }
  return true;
}
