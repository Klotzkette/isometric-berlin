import owners from "./data/lehrterKulturhausOwnersV366.json";
import roofs from "./data/lehrterKulturhausRoofsV366.json";
import type { PrismBuilding } from "./IsometricCityWorld";

export const LEHRTER_BRICK = 0x9e6253;
export const LEHRTER_TILE = 0x965744;
type Roof = { eaveMm: number; positionsMm: number[][]; indices: number[]; sourceSheets: number };
const profiles = new Map<string, Roof>(Object.entries(roofs));
const fingerprints = new Map(
  Object.entries(owners).map(([id, prism]) => [id as string, JSON.stringify(prism)])
);
export function lehrterKulturhausOwnerV366(record: unknown): boolean {
  if (!record || typeof record !== "object" || !("id" in record) || typeof record.id !== "string")
    return false;
  const expected = fingerprints.get(record.id);
  return expected !== undefined && JSON.stringify(record) === expected;
}

/** Both measured main roofs share a level eave with the original retained footprint. */
export function lehrterKulturhausRoofV366(building: PrismBuilding) {
  const roof = profiles.get(building.id);
  if (!roof || !lehrterKulturhausOwnerV366(building)) return null;
  const triangles = new Float32Array(roof.indices.length * 3);
  for (let i = 0; i < roof.indices.length; i++) {
    const vertex = roof.positionsMm[roof.indices[i]];
    for (let a = 0; a < 3; a++) triangles[3 * i + a] = vertex[a] / 1000;
  }
  return { triangles, wallHeight: roof.eaveMm / 1000 - building.y0_dm / 10 };
}
