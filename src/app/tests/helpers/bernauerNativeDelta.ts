import type { VoxelBuildingColumn } from "../../src/MinecraftVoxelWorld";

type LegacyPrism = {
  id: string;
  ring: number[][];
  holes: number[][][];
  y0_dm: number;
  h_dm: number;
};

const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const key = ([x, z]: readonly number[]) => `${x},${z}`;

// Independent integer-coordinate ray crossing; do not call the production
// ownership predicate when deciding which historical cells should disappear.
function inside(x: number, z: number, ring: number[][]): boolean {
  let result = false;
  for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    const u = ring[a], v = ring[b];
    if ((u[1] > z) !== (v[1] > z) &&
      x < (v[0] - u[0]) * (z - u[1]) / (v[1] - u[1]) + u[0]) result = !result;
  }
  return result;
}

/** Independently enumerate the two old bodies and their affected grid faces. */
export function auditBernauerNativeDelta(
  columns: VoxelBuildingColumn[], cell: number, prisms: LegacyPrism[],
) {
  const sourceColumnsByPrism = prisms.map((prism) => {
    const xs = prism.ring.map(([x]) => x), zs = prism.ring.map(([, z]) => z);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const selected = columns.filter(([x, z, base, top]) => {
      const px = (x + 0.5) * cell * 10, pz = (z + 0.5) * cell * 10;
      return px >= minX && px <= maxX && pz >= minZ && pz <= maxZ &&
        base === prism.y0_dm &&
        top - base === Math.ceil(prism.h_dm / (cell * 10)) * cell * 10 &&
        inside(px, pz, prism.ring) && !prism.holes.some((hole) => inside(px, pz, hole));
    });
    return { id: prism.id, columns: selected };
  });
  const removedColumns = sourceColumnsByPrism.flatMap(({ columns }) => columns);
  const removedKeys = new Set(removedColumns.map(key));
  const affectedKeys = new Set(removedKeys);
  for (const [x, z] of removedColumns) {
    for (const [dx, dz] of directions) affectedKeys.add(key([x + dx, z + dz]));
  }
  // A second cell of halo includes every possible occluder of the neighboring
  // faces. Only rows in the first halo can gain or lose a pane.
  const haloKeys = new Set(affectedKeys);
  for (const value of affectedKeys) {
    const [x, z] = value.split(",").map(Number);
    for (const [dx, dz] of directions) haloKeys.add(key([x + dx, z + dz]));
  }
  const localColumns = columns.filter((column) => haloKeys.has(key(column)));
  const retainedNeighbourColumns = localColumns.filter((column) => !removedKeys.has(key(column)));
  const panes = (source: VoxelBuildingColumn[]) => {
    const tops = new Map<string, number>();
    for (const column of source) {
      tops.set(key(column), Math.max(tops.get(key(column)) ?? -Infinity, column[3] / 10));
    }
    const result = new Set<string>();
    for (const [x, z, base, top] of source) {
      if (!affectedKeys.has(key([x, z]))) continue;
      for (const [dx, dz] of directions) {
        const neighbourTop = tops.get(key([x + dx, z + dz])) ?? -Infinity;
        for (let y = Math.ceil((base / 10 + 2) / cell) * cell; y + 1.2 <= top / 10; y += cell) {
          if (neighbourTop < y + 1) result.add([x, z, dx, dz, y].join(","));
        }
      }
    }
    return result;
  };
  const before = panes(localColumns), after = panes(retainedNeighbourColumns);
  const removedPanes = [...before].filter((pane) => !after.has(pane)).length;
  const exposedPanes = [...after].filter((pane) => !before.has(pane)).length;
  return {
    removedColumns,
    localColumns,
    retainedNeighbourColumns,
    sourceColumnsByPrism: sourceColumnsByPrism.map(({ id, columns }) => ({
      id, count: columns.length,
      sha256: new Bun.CryptoHasher("sha256").update(JSON.stringify(columns)).digest("hex"),
    })),
    panes: { removed: removedPanes, exposed: exposedPanes, netRemoved: removedPanes - exposedPanes },
    removedColumnInstances: {
      full: removedColumns.reduce((sum, [, , base, top]) => {
        const height = Math.max(cell, (top - base) / 10);
        return sum + 1 + Number(height > 5) + Number(height > 8);
      }, 0),
      mobile: removedColumns.length,
    },
  };
}
