import type { PrismBuilding } from "./IsometricCityWorld";
import owners from "./data/zilleEstateOwnersV366.json";
import roofs from "./data/zilleEstateRoofsV366.json";

type SurveyedRoof = { eaveMm: number; positionsMm: number[][]; indices: number[]; sourceSheets: number };
const expected = new Map(Object.entries(owners).map(([id, record]) => [id as string, JSON.stringify(record)]));
const measured = new Map<string, SurveyedRoof>(Object.entries(roofs));

export function zilleEstateOwnerV366(record: PrismBuilding): boolean {
  const prior = expected.get(record.id);
  return prior !== undefined && JSON.stringify(record) === prior;
}

/** Four shallow compound roofs identified by their complete retained prism. */
export function zilleEstateRoofV366(building: PrismBuilding) {
  const surface = measured.get(building.id);
  if (!surface || !zilleEstateOwnerV366(building)) return null;
  const triangles = new Float32Array(surface.indices.length * 3);
  surface.indices.forEach((index, corner) => {
    const vertex = surface.positionsMm[index];
    for (let axis = 0; axis < 3; axis++) triangles[corner * 3 + axis] = vertex[axis] / 1000;
  });
  return { triangles, wallHeight: surface.eaveMm / 1000 - building.y0_dm / 10 };
}
