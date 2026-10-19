import payload from "./data/museumBridgesV243.json";
import previous from "./data/museumBridgePreviousV243.json";
import { groundTopSampler, type VoxelPayload } from "./terrainPayload";
import type { SpreeBridgeCorePacketV242 } from "./SpreeBridgesV242";

/** Constructor-only input, released after the complete pair has decoded. */
export function museumBridgePacketsV243(native = false): SpreeBridgeCorePacketV242[] {
  return payload.core[native ? "minecraft" : "drawn"] as unknown as SpreeBridgeCorePacketV242[];
}

const receipts = new Map(previous.records.map(r => [
  r.cells.map(p => p.join(",")).sort().join(";"), r,
]));

/** No proximity-based retirement: every old source cell and datum must agree. */
export function museumBridgeOwnerV243(ground: VoxelPayload, cluster: Array<[number, number]>): string | null {
  if (ground.cell_m !== previous.cellM || !cluster.length) return null;
  const cells = cluster.map(([x, z]) => `${(x + ground.grid.min_x_idx) * ground.cell_m},${(z + ground.grid.min_z_idx) * ground.cell_m}`);
  const receipt = receipts.get(cells.sort().join(";"));
  if (!receipt) return null;
  const top = groundTopSampler(ground);
  let base = (ground.water_top_y_m ?? 1.31) + 5.4;
  for (const [x, z] of cluster) base = Math.max(base, top(x, z) + .55);
  return Math.abs(base - receipt.baseY) <= .001 ? receipt.sourceId : null;
}
