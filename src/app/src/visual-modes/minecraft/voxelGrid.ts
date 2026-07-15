/**
 * Shared voxel-grid sizing for the Minecraft mode. v0.5.3 doubled the
 * base cell (2.35 -> 4.7 coarse, 2.8 -> 5.6 fine) so blocks read twice
 * as chunky at every zoom level. The cap keeps a base cell below
 * ~24 device pixels — beyond that individual buildings collapse into
 * single blocks.
 */
export const VOXEL_BASE_CELL_DEVICE_PX = {
  coarse: 4.7,
  fine: 5.6,
} as const;

export const VOXEL_BASE_CELL_CAP_DEVICE_PX = 24;

export function voxelBaseCell(coarseLayout: boolean): number {
  const base = coarseLayout
    ? VOXEL_BASE_CELL_DEVICE_PX.coarse
    : VOXEL_BASE_CELL_DEVICE_PX.fine;
  return Math.min(base, VOXEL_BASE_CELL_CAP_DEVICE_PX);
}

/**
 * World/scene anchor for the voxel post-process grid, in device pixels.
 * The caller passes the on-screen pixel position of a fixed world point
 * (the map's content origin in 2D, or the projected scene origin in 3D).
 * Only the position *within* one block cell affects how fragments bucket
 * into blocks, so the offset is wrapped into `[0, block)` on both axes.
 * This keeps the value tiny and precise as a shader uniform while still
 * translating the block lattice exactly with the geometry, so blocks stay
 * glued to the world instead of shimmering across a fixed screen grid.
 */
export function voxelGridOffset(
  anchorPixelX: number,
  anchorPixelY: number,
  block: number,
): readonly [number, number] {
  const cell = Math.max(1, block);
  const wrap = (value: number): number => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return ((value % cell) + cell) % cell;
  };
  return [wrap(anchorPixelX), wrap(anchorPixelY)];
}
