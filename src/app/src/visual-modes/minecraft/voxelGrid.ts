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
