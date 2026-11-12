import data from "./data/potsdamerNorthPavilionSource.json";
import type { VoxelBuildingColumn, VoxelPayload } from "./terrainPayload";
import { canReplacePotsdamerSouthStationPhoto } from "./potsdamerStationPhotoOwnership";

export const POTSDAMER_NORTH_PAVILION_SOURCE_ID = data.northPrism.id;
type SourcePrism = typeof data.northPrism;
const fingerprint = (p: Partial<SourcePrism>) => JSON.stringify([p.id, p.ring, p.holes, p.y0_dm, p.h_dm, p.class, p.roof, p.tone]);
const north = fingerprint(data.northPrism);
const columnKeys = new Set(data.northColumns.map(row => row.join("/")));
const sourceCells = new Set(data.northColumns.map(row => `${row[0]}/${row[1]}`));

export function isPotsdamerNorthPavilionSource(record: unknown): boolean {
  return Boolean(record && typeof record === "object" && "id" in record &&
    record.id === POTSDAMER_NORTH_PAVILION_SOURCE_ID && fingerprint(record as SourcePrism) === north);
}

export function canReplacePotsdamerNorthPavilion(prisms?: readonly unknown[]): boolean {
  if (!prisms || !canReplacePotsdamerSouthStationPhoto(prisms)) return false;
  const north = prisms.filter(p => p && typeof p === "object" && "id" in p && p.id === POTSDAMER_NORTH_PAVILION_SOURCE_ID);
  return north.length === 1 && isPotsdamerNorthPavilionSource(north[0]);
}

function inRing(x: number, z: number, ring: readonly number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[j], [bx, bz] = ring[i];
    if ((az > z) !== (bz > z) && x < ax + (bx - ax) * (z - az) / (bz - az)) inside = !inside;
  }
  return inside;
}

export function exactNorthPavilionColumns(prisms: readonly unknown[] | undefined, payload: VoxelPayload): ((...row: VoxelBuildingColumn) => boolean) | null {
  if (payload.cell_m !== 4 || !canReplacePotsdamerNorthPavilion(prisms)) return null;
  const observed = new Set<string>();
  let changed = false;
  const inspect = (row: VoxelBuildingColumn) => {
    if (!sourceCells.has(`${row[0]}/${row[1]}`)) return;
    const key = row.join("/");
    if (!columnKeys.has(key) || observed.has(key)) changed = true;
    observed.add(key);
  };
  if (payload.building_rows) {
    for (let z = 250; z <= 256; z++) {
      for (const [offset, length, bottom, top, kind] of payload.building_rows[z - payload.grid.min_z_idx] ?? []) {
        const start = payload.grid.min_x_idx + offset;
        for (let x = Math.max(67, start); x < Math.min(74, start + length); x++) inspect([x, z, bottom, top, kind]);
      }
    }
  } else for (const row of payload.buildings ?? []) inspect(row);
  if (changed || observed.size !== columnKeys.size) return null;
  for (const value of prisms ?? []) {
    if (!value || typeof value !== "object" || isPotsdamerNorthPavilionSource(value)) continue;
    const record = value as Partial<SourcePrism>;
    if (!record.ring?.length) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of record.ring) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    if (maxX < 2670 || minX > 2960 || maxZ < 9990 || minZ > 10290) continue;
    if (data.northColumns.some(([ix, iz]) => {
      const x = (ix + .5) * 40, z = (iz + .5) * 40;
      return inRing(x, z, record.ring!) && !record.holes?.some(h => inRing(x, z, h));
    })) return null;
  }
  return (...row) => columnKeys.has(row.join("/"));
}
