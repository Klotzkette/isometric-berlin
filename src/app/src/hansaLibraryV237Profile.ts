import source from "./data/hansaLibraryV237.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
import { bebelplatzPartRoofAt } from "./bebelplatzBuildingProfile";

export const HANSA_LIBRARY_PRISM_IDS_V237: ReadonlySet<string> = new Set(source.prismIds);
export const HANSA_LIBRARY_PARTS_V237 = source.parts;
const byId = new Map(source.parts.map(part => [part.id.slice(-8), part]));

export function hansaLibraryPartForPrismV237(id: string) {
  return byId.get(id);
}

export function hansaLibraryRoofAtV237(part: typeof source.parts[number], x: number, z: number) {
  return bebelplatzPartRoofAt(part, x, z);
}

/** Only the four receipted old library owners yield to the complete measured shell. */
export function isHansaLibraryReplacementColumnV237(x: number, z: number): boolean {
  if (x < -1972 || x > -1932 || z < 136 || z > 176) return false;
  return source.previousPrisms.some(part =>
    pointInWorldRing(x * 10, z * 10, part.ring as unknown as WorldRing) &&
    !part.holes.some(hole => pointInWorldRing(x * 10, z * 10, hole as WorldRing)));
}
