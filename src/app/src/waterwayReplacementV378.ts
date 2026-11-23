import { Group } from "three";
import type { VoxelPayload } from "./terrainPayload";
import data from "./data/waterwayCoreV378.json";
import {
  Batch,
  drawCrossingV378,
  type WaterwayCrossingV378,
} from "./waterwayBridgeGeometryV378";
import { registerLandwehrFloorsV378 } from "./waterwayFloorsV378";

type Cell = [number, number];
const unpack = (delta: number[]) => {
  let n = 0;
  return delta.map((v) => (n += v));
};
type Match = { cells: number[]; covered: Record<string, number[]> };
const candidates = new Map<number, Match>();
const required = new Map<string, number[]>();
for (const [delta, parts] of data.clusters as unknown as [
  number[],
  Record<string, number[]>,
][]) {
  const cells = unpack(delta),
    key = cells[0];
  const covered = Object.fromEntries(
    Object.entries(parts).map(([id, d]) => [id, unpack(d)]),
  );
  candidates.set(key, { cells, covered });
  for (const id of Object.keys(covered))
    required.set(id, [...(required.get(id) ?? []), key]);
}
export const coreCrossingsV378 =
  data.spans as unknown as WaterwayCrossingV378[];

/** Split only a verified source cluster. A long S-Bahn approach connected
 * to a bridge over the canal must keep its independent, existing structure. */
function remainingGroups(cells: Cell[]): Cell[][] {
  const pending = new Map(cells.map((p) => [p[1] * 65536 + p[0], p]));
  const groups: Cell[][] = [];
  while (pending.size) {
    const [first, seed] = pending.entries().next().value!;
    pending.delete(first);
    const group = [seed];
    for (let i = 0; i < group.length; i++) {
      const [x, z] = group[i];
      for (let dz = -2; dz <= 2; dz++)
        for (let dx = -2; dx <= 2; dx++) {
          const key = (z + dz) * 65536 + (x + dx),
            cell = pending.get(key);
          if (cell) {
            group.push(cell);
            pending.delete(key);
          }
        }
    }
    groups.push(group);
  }
  return groups;
}
export function prepareLandwehrClustersV378(
  ground: VoxelPayload,
  clusters: Cell[][],
) {
  const g = ground.grid,
    expect = data.grid;
  if (
    g.min_x_idx !== expect[0] ||
    g.min_z_idx !== expect[1] ||
    g.cols !== expect[2] ||
    g.rows !== expect[3] ||
    ground.cell_m !== expect[4]
  )
    return { clusters, root: null };
  const matches = new Map<Cell[][][number], Match>();
  const accepted = new Set<number>();
  for (const cluster of clusters) {
    const ids = cluster.map(([x, z]) => z * g.cols + x).sort((a, b) => a - b);
    const match = candidates.get(ids[0]);
    if (
      match &&
      match.cells.length === ids.length &&
      match.cells.every((id, i) => ids[i] === id)
    ) {
      matches.set(cluster, match);
      accepted.add(ids[0]);
    }
  }
  const rows = coreCrossingsV378.filter((r) =>
    required.get(r.id)?.every((k) => accepted.has(k)),
  );
  if (!rows.length) return { clusters, root: null };
  const batch = new Batch();
  for (const row of rows) drawCrossingV378(batch, row, false);
  const mesh = batch.mesh("Landwehrkanal bridges — surveyed core spans");
  if (!mesh) return { clusters, root: null };
  const root = new Group();
  root.name = "Landwehrkanal surveyed core bridges";
  root.add(mesh);
  root.userData.waterwaysV378 = rows.map((r) => r.id);
  // The caller adds this owner above its completed bridge group. Scene
  // teardown explicitly disposes the mesh even if the whole group detaches.
  registerLandwehrFloorsV378(root, rows, false);
  const usable = new Set(rows.map((r) => r.id));
  const remainder: Cell[][] = [];
  for (const cluster of clusters) {
    const match = matches.get(cluster);
    if (!match) {
      remainder.push(cluster);
      continue;
    }
    const owned = new Set(
      Object.entries(match.covered)
        .filter(([id]) => usable.has(id))
        .flatMap(([, cells]) => cells),
    );
    if (!owned.size) {
      remainder.push(cluster);
      continue;
    }
    remainder.push(
      ...remainingGroups(
        cluster.filter(([x, z]) => !owned.has(z * g.cols + x)),
      ),
    );
  }
  return { clusters: remainder, root };
}
