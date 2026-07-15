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
 * Scales the on-screen block size with the map zoom so a block always
 * covers the same *world* area, no matter how far in the user has zoomed.
 *
 * Why this matters for stability: a fragment's block index is
 * `floor((screenPos - anchor) / cell)`. A world feature's screen distance
 * from the anchor grows in proportion to the zoom (`relWorld * zoom`). If
 * `cell` also grows in proportion to the zoom, the zoom cancels out of the
 * index and every world feature keeps the *same* block through the whole
 * zoom — so blocks stay glued to the geometry instead of re-quantizing and
 * swimming while the camera moves (requirement #6). A fixed screen-space
 * cell can only stay glued under pure panning; under zoom it inevitably
 * decays, which is what users still saw after the v0.5.4 pan anchor.
 *
 * `scale` is the current zoom relative to the zoom at which the base cell
 * should apply (pass `currentZoom / minZoom`, so `scale === 1` at the
 * furthest-out view). The result is clamped to `[base, cap]`: never smaller
 * than the base cell, never so large a whole building collapses to a block.
 */
export function voxelCellForScale(base: number, scale: number): number {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const scaled = base * safeScale;
  const floor = Math.min(base, VOXEL_BASE_CELL_CAP_DEVICE_PX);
  return Math.min(VOXEL_BASE_CELL_CAP_DEVICE_PX, Math.max(floor, scaled));
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
