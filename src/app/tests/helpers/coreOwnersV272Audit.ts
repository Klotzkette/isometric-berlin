import type { VoxelBuildingColumn } from '../../src/terrainPayload';
import theatres from '../../src/data/theatresV272Navigation.json';
import press from '../../src/data/pressQuarterV272Navigation.json';

type Owner = { column: VoxelBuildingColumn; ownerIds: string[] };
const key = (x: number, z: number) => `${x},${z}`;

// Independent ring crossing and integer-decimetre height check. This audit
// deliberately does not import either production source-column predicate.
function inside(x: number, z: number, ring: readonly number[][]): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

export function auditCoreOwnersV272(columns: VoxelBuildingColumn[], cell: number) {
  const prisms = [
    ...theatres.legacyPrisms.map(prism => ({ ...prism, ownerId: `theatres:${prism.id}` })),
    ...press.legacyPrisms.map(prism => ({ ...prism, ownerId: `press:${prism.id}` })),
  ].map(prism => ({ ...prism, minX: Math.min(...prism.ring.map(p => p[0])),
    maxX: Math.max(...prism.ring.map(p => p[0])), minZ: Math.min(...prism.ring.map(p => p[1])),
    maxZ: Math.max(...prism.ring.map(p => p[1])) }));
  const owned: Owner[] = [], byCell = new Map<string, Owner[]>();
  for (const column of columns) {
    const [x, z, lo, hi] = column, px = (x + .5) * cell * 10, pz = (z + .5) * cell * 10;
    const ownerIds = prisms.filter(p => lo === p.y0_dm && hi === lo + Math.ceil(p.h_dm / 40) * 40 &&
      px >= p.minX && px <= p.maxX && pz >= p.minZ && pz <= p.maxZ &&
      inside(px, pz, p.ring) && !p.holes.some(h => inside(px, pz, h))).map(p => p.ownerId);
    if (!ownerIds.length) continue;
    const item = { column, ownerIds }; owned.push(item);
    const at = key(x, z); byCell.set(at, [...(byCell.get(at) ?? []), item]);
  }
  const neighbours = new Map<string, VoxelBuildingColumn[]>();
  for (const column of columns) {
    const [x, z] = column;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => byCell.has(key(x + dx, z + dz)))) continue;
    const at = key(x, z); neighbours.set(at, [...(neighbours.get(at) ?? []), column]);
  }
  function paneCell(record: Float32Array) {
    const dx = record[8], dz = record[10];
    if (Math.abs(dx) + Math.abs(dz) !== 1) return null;
    const x = (record[12] - dx * (cell / 2 + .08)) / cell - .5;
    const z = (record[14] - dz * (cell / 2 + .08)) / cell - .5;
    if (Math.abs(x - Math.round(x)) > .001 || Math.abs(z - Math.round(z)) > .001) return null;
    return { x: Math.round(x), z: Math.round(z), dx, dz };
  }
  return {
    owned,
    removed(record: Float32Array, windows: boolean): Owner | undefined {
      const point = windows ? paneCell(record) : {
        x: Math.round(record[12] / cell - .5), z: Math.round(record[14] / cell - .5),
      };
      if (!point) return;
      if (!windows && (Math.abs(record[12] - (point.x + .5) * cell) > .001 ||
        Math.abs(record[14] - (point.z + .5) * cell) > .001)) return;
      const bottom = record[13] - (windows ? 0 : record[5] / 2);
      const top = record[13] + (windows ? 1.2 : record[5] / 2);
      return byCell.get(key(point.x, point.z))?.find(({ column: [, , lo, hi] }) =>
        bottom >= lo / 10 - .001 && top <= hi / 10 + .001);
    },
    exposed(record: Float32Array): Owner | undefined {
      const point = paneCell(record);
      if (!point) return;
      const { x, z, dx, dz } = point, y = record[13];
      // The pane is still on an actual surviving source column and faces the
      // exact retired neighbour which used to occlude this row.
      if (!(neighbours.get(key(x, z)) ?? []).some(column => column[2] / 10 <= y &&
        column[3] / 10 >= y + 1.2 && !owned.some(owner => owner.column === column))) return;
      return byCell.get(key(x + dx, z + dz))?.find(({ column: [, , lo, hi] }) => lo / 10 <= y && hi / 10 >= y + 1);
    },
  };
}
