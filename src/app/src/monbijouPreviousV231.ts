import source from "./data/monbijouV231Receipt.json";
import type { VoxelPayload } from "./terrainPayload";

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
/** Only the two complete immutable cluster fingerprints and exact bench records
 * may yield to the mandatory replacements. No geographic suppression. */
export const MONBIJOU_V231_PREVIOUS = freeze(source);
const clusters = source.clusters.map(c => ({ count: c.cells.length,
  keys: new Set(c.cells.map(([x, z]) => `${x}:${z}`)) }));
const benches = new Map<string, typeof source.benches[number]>(source.benches.map(b => [b.id, b]));

export function isMonbijouBridgeClusterV231(ground: VoxelPayload, cells: readonly (readonly number[])[]): boolean {
  const r = MONBIJOU_V231_PREVIOUS.ground;
  if (ground.cell_m !== r.cell_m || ground.classes.indexOf("bridge") !== r.bridgeClass ||
      Object.entries(r.grid).some(([key, value]) => ground.grid[key as keyof typeof ground.grid] !== value)) return false;
  if (!ground.ground_height || Object.entries(r.heightGrid).some(([key, value]) =>
      ground.ground_height?.[key as "stride_cells" | "cols" | "rows"] !== value) ||
      r.heightSamples.some(([i, y]) => ground.ground_height?.y_dm[i] !== y)) return false;
  const keys = new Set(cells.map(([x, z]) => `${x}:${z}`));
  return keys.size === cells.length && clusters.some(c => c.count === cells.length && [...keys].every(k => c.keys.has(k)));
}

/** Remove only complete, unchanged old bridge raster owners from native ground
 * construction. The neighbour halo proves no new connected cells were added;
 * the resulting closure retains a 15-cell set, never the full voxel payload. */
export function createMonbijouGroundCellTesterV231(ground: VoxelPayload): (x: number, z: number) => boolean {
  const accepted = new Set<string>();
  const bridgeClass = MONBIJOU_V231_PREVIOUS.ground.bridgeClass;
  const isBridge = (x: number, z: number) => ground.ground_rows[z]?.some(([start, count, c]) =>
    c === bridgeClass && x >= start && x < start + count) ?? false;
  for (const cluster of MONBIJOU_V231_PREVIOUS.clusters) {
    if (!isMonbijouBridgeClusterV231(ground, cluster.cells)) continue;
    const keys = new Set(cluster.cells.map(([x,z]) => `${x}:${z}`));
    let exact = cluster.cells.every(([x,z]) => isBridge(x,z));
    for (const [x,z] of cluster.cells) for (let dx=-2;dx<=2;dx++) for (let dz=-2;dz<=2;dz++)
      if (!keys.has(`${x+dx}:${z+dz}`) && isBridge(x+dx,z+dz)) exact = false;
    if (exact) for (const key of keys) accepted.add(key);
  }
  const {min_x_idx: minX, min_z_idx: minZ} = ground.grid, cell = ground.cell_m;
  return (x,z) => accepted.has(`${Math.floor(x/cell)-minX}:${Math.floor(z/cell)-minZ}`);
}

export function isMonbijouBenchV231(p: { id: string; x: number; y: number; z: number; tags: object }): boolean {
  const r = benches.get(p.id);
  if (!r || r.x !== p.x || r.y !== p.y || r.z !== p.z) return false;
  const tags = p.tags as Record<string, unknown>;
  return Object.keys(tags).length === Object.keys(r.tags).length &&
    Object.entries(r.tags).every(([key, value]) => tags[key] === value);
}
