import receipts from "./data/lehrterGardenCorrectionsV358.json";
import type { PrismBuilding, PrismPayload } from "./IsometricCityWorld";
import type { VoxelPayload } from "./terrainPayload";

type VoxelRun = NonNullable<VoxelPayload["building_rows"]>[number][number];

const buildingReceipts = new Map(receipts.buildings.map((receipt) => [receipt.prior.id, receipt]));

function sameBuilding(building: PrismBuilding, prior: typeof receipts.buildings[number]["prior"]): boolean {
  return building.class === prior.class
    && building.h_dm === prior.h_dm
    && building.y0_dm === prior.y0_dm
    && building.roof === prior.roof
    && JSON.stringify(building.ring) === JSON.stringify(prior.ring)
    && JSON.stringify(building.holes) === JSON.stringify(prior.holes)
    && JSON.stringify(building.tone) === JSON.stringify(prior.tone);
}

/** The 1 m DOP-aligned surface/terrain differences replace inherited 9 m fallback heights. */
export function correctGardenPrismsV358(payload: PrismPayload): PrismPayload {
  if (payload.schema_version !== receipts.prismSchema) return payload;
  const corrections = new Map<number, number>();
  const seen = new Set<string>();
  for (let index = 0; index < payload.buildings.length; index += 1) {
    const building = payload.buildings[index];
    const receipt = buildingReceipts.get(building.id);
    if (!receipt) continue;
    if (seen.has(building.id) || !sameBuilding(building, receipt.prior)) return payload;
    seen.add(building.id);
    corrections.set(index, receipt.newHeightDm);
  }
  if (corrections.size !== buildingReceipts.size) return payload;
  return {
    ...payload,
    buildings: payload.buildings.map((building, index) => {
      const height = corrections.get(index);
      return height === undefined ? building : { ...building, h_dm: height };
    }),
  };
}

function splitRun(run: VoxelRun, offsets: readonly number[]): VoxelRun[] {
  const [start, length, base, top, material] = run;
  const replacements: VoxelRun[] = [];
  const rowsEnd = start + length;
  let cursor = start;
  for (const offset of offsets) {
    if (offset > cursor) replacements.push([cursor, offset - cursor, base, top, material]);
    // The measured 2–3 m roofs occupy a single 4 m Native story.
    replacements.push([offset, 1, base, base + receipts.cellM * 10, material]);
    cursor = offset + 1;
  }
  if (cursor < rowsEnd) replacements.push([cursor, rowsEnd - cursor, base, top, material]);
  return replacements;
}

/** Replaces only the validated columns with independently rasterized footprint owners. */
export function correctGardenVoxelsV358(payload: VoxelPayload): VoxelPayload {
  const { building_rows: rows, grid } = payload;
  if (!rows || payload.schema_version !== receipts.voxelSchema || payload.cell_m !== receipts.cellM
    || grid.min_x_idx !== receipts.grid.min_x_idx || grid.min_z_idx !== receipts.grid.min_z_idx
    || grid.cols !== receipts.grid.cols || grid.rows !== receipts.grid.rows) return payload;

  const corrections = new Map<number, Map<number, VoxelRun[]>>();
  for (const receipt of receipts.voxelRuns) {
    const row = rows[receipt.row];
    if (!row) return payload;
    const index = row.findIndex((run) => run.every((value, field) => value === receipt.prior[field]));
    if (index < 0 || corrections.get(receipt.row)?.has(index)) return payload;
    for (const offset of receipt.xOffsets) {
      const owners = row.filter(([start, length]) => start <= offset && offset < start + length);
      if (owners.length !== 1 || owners[0] !== row[index]) return payload;
    }
    const rowCorrections = corrections.get(receipt.row) ?? new Map<number, VoxelRun[]>();
    rowCorrections.set(index, splitRun(row[index], receipt.xOffsets));
    corrections.set(receipt.row, rowCorrections);
  }

  const buildingRows = rows.slice();
  for (const [index, replacements] of corrections) {
    buildingRows[index] = rows[index].flatMap((run, runIndex) => replacements.get(runIndex) ?? [run]);
  }
  return { ...payload, building_rows: buildingRows };
}
