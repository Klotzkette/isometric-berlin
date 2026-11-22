import type { VoxelPayload } from "./terrainPayload";

/** Canonical 16 m DGM samples surrounding the measured Simsonweg, including the interpolation rim. */
export function admitsSimsonGroundV375(ground: VoxelPayload): boolean {
  const { grid, ground_height: h } = ground;
  if (ground.cell_m !== 4 || grid.min_x_idx !== -975 || grid.min_z_idx !== -905 ||
      grid.cols !== 1578 || grid.rows !== 1633 || h.stride_cells !== 4 || h.cols !== 395) return false;
  let hash = 2166136261;
  for (let z = 230; z < 247; z++) {
    for (let x = 249; x < 271; x++) hash = Math.imul(hash ^ h.y_dm[z * h.cols + x], 16777619);
  }
  return (hash >>> 0) === 1538018404;
}
