import theatre from "./data/volksbuehneOwnershipV209.json";
import helmholtz from "./data/kiezSitesOwnershipV209.json";
import prisons from "./data/prisonsMemorialsOwnershipV209.json";
import { transferExactPacketLines, transferExactPacketTriangles } from "./exactPacketTransfer";
import { transferPrisonsNavigationV209 } from "./prisonsNavigationTransferV209";
import type { SurroundingNavigation, SurroundingPackedLines, SurroundingPackedMesh } from "./SurroundingCityGeometry";

const triangles = [...theatre.records, ...helmholtz.records, ...prisons.records];
const lines = [...helmholtz.lineRecords, ...prisons.lineRecords];

/** Each replacement body is required in the city construction transaction. */
export function* transferSiteTrianglesV209(tile: string, native: boolean,
  part: SurroundingPackedMesh, indices: Uint16Array | Uint32Array, offset: number): Generator<void, number> {
  return yield* transferExactPacketTriangles(triangles, tile, native, part, indices, offset);
}
export function* transferSiteLinesV209(tile: string, part: SurroundingPackedLines,
  values: Uint16Array, stride: number): Generator<void, number> {
  return yield* transferExactPacketLines(lines, tile, part, values, stride);
}

const equalRing = (a: number[][], b: number[][]) => a.length === b.length &&
  a.every((p, i) => p.length === b[i].length && p.every((v, j) => v === b[i][j]));

/** Correct the obsolete Platzhaus collision roof only with the complete exact
 * source nav record as guard. The input packet and all other owners stay intact. */
export function siteNavigationV209(tile: string, original: SurroundingNavigation): SurroundingNavigation {
  const nav = transferPrisonsNavigationV209(tile, original);
  const records = helmholtz.navigationRecords.filter(record => record.tile === tile);
  if (!records.length) return nav;
  let changed = false;
  const buildings = nav.buildings.map(building => {
    const record = records.find(r => building.sourceId === r.owner &&
      building.height === r.original.height && building.minHeight === r.original.minHeight &&
      equalRing(building.ring, r.original.ring) && building.holes.length === r.original.holes.length &&
      building.holes.every((ring, i) => equalRing(ring, r.original.holes[i])));
    if (!record) return building;
    changed = true;
    return { ...building, height: record.newHeight };
  });
  return changed ? { ...nav, buildings } : nav;
}
