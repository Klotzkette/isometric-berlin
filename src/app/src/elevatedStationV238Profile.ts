import source from "./data/elevatedCoreOwnersV238.json";

/** Only the three independently receipted ground-filled Gleisdreieck proxies
 * yield to the required complete two-level station and bridge construction. */
export const ELEVATED_STATION_PRISM_IDS_V238: ReadonlySet<string> = new Set(source.prismIds);
export const ELEVATED_STATION_SOLIDS_V238 = source.navigationSolids as {
  ring: number[][]; holes: number[][][]; minY: number; maxY: number;
}[];
const columns = new Set(source.previousColumns.map(column => `${column.x},${column.z}`));

export function isElevatedStationReplacementColumnV238(x: number, z: number): boolean {
  return x >= 70 && x <= 230 && z >= 2080 && z <= 2250 && columns.has(`${x},${z}`);
}
