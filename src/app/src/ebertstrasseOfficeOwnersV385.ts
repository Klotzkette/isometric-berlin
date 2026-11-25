import owners from "./data/ebertstrasseOfficesV385/owners.json";

type Prism = {id: string; y0_dm: number; h_dm: number; ring: readonly (readonly number[])[]; roof?: number};
type Source = [string, number, number, number, number[]];
const prisms = new Map((owners.prisms as Source[]).map(row => [row[0], row]));
export const EBERTSTRASSE_OFFICE_PARTS_V385 = [...prisms.keys()];
const columns = new Map(owners.columns.map(row => [row[0] + row[1] * 512, row]));

/** Preserve the lower blocks. The measured terraces and their open rails occupy the upper storey. */
export function ebertstrasseTerracePrismV385<T extends Prism>(building: T): T {
  const found = prisms.get(building.id);
  if (!found || found[1] !== building.y0_dm || found[2] !== building.h_dm ||
      found[4][0] !== building.ring[0]?.[0] || found[4][1] !== building.ring[0]?.[1]) return building;
  return {...building, h_dm: found[3] - building.y0_dm, roof: 1000};
}

/** Require the exact original class, position and heights on the published voxel grid. */
export function ebertstrasseTerraceTopV385(x: number, z: number, lo: number, hi: number, cls: number): number {
  if (x < 91 || x > 97 || z < 211 || z > 223) return hi;
  const found = columns.get(x + z * 512);
  return found && found[2] === lo && found[3] === hi && found[4] === cls ? found[5] : hi;
}

export function isEbertstrasseFacadeColumnV385(x: number, z: number, lo: number, hi: number, cls: number): boolean {
  if (x < 91 || x > 97 || z < 211 || z > 223) return false;
  const column = columns.get(x + z * 512);
  return column !== undefined && column[2] === lo && column[4] === cls && column[5] === hi;
}

type OfficeObstacle = { native: boolean; bottom: number; top: number; ring: number[][] };
export function ebertstrasseObstaclesV385(id: string): readonly OfficeObstacle[] {
  return (owners.obstacles as Record<string, OfficeObstacle[]>)[id] ?? [];
}
