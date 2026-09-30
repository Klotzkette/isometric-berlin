import source from "./gendarmenmarktPerimeterSource.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
import { bebelplatzPartContains, bebelplatzPartRoofAt } from "./bebelplatzBuildingProfile";

export const GENDARMENMARKT_PERIMETER_SOURCE = source;
export const GENDARMENMARKT_PERIMETER_BUILDINGS = source.buildings;

const byPrism = new Map(source.buildings.flatMap(building =>
  building.prismIds.map(id => [id, building] as const)));

export function gendarmenmarktPerimeterSourceForPrism(id: string) {
  return byPrism.get(id);
}

const families = source.buildings.map(building => {
  // The delivered coarse prisms can differ from the new official footprints.
  // Clear their complete former skin as well, converting decimetres only once.
  const previousParts = building.previousDisplayPrisms.map(part => ({
    ring: part.ring.map(p => [p[0] / 10, p[1] / 10] as const),
    holes: part.holes.map(hole => hole.map(p => [p[0] / 10, p[1] / 10] as const)),
  }));
  const points = [
    ...building.parts.flatMap(part => part.ring),
    ...building.officialParts.flatMap(part => part.ring),
    ...previousParts.flatMap(part => part.ring),
  ];
  return { building, previousParts, bounds: [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
    Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))] };
});

/** Exact former/official footprints, with a cheap neighbourhood and family gate. */
export function isGendarmenmarktPerimeterReplacementColumn(x: number, z: number): boolean {
  if (x < 1100 || x > 1800 || z < 380 || z > 950) return false;
  for (const { building, previousParts, bounds } of families) {
    if (x < bounds[0] || x > bounds[2] || z < bounds[1] || z > bounds[3]) continue;
    if (building.officialParts.some(part => bebelplatzPartContains(part, x, z))) return true;
    if (building.parts.some(part => pointInWorldRing(x, z, part.ring as unknown as WorldRing) &&
      !part.holes.some(hole => pointInWorldRing(x, z, hole as unknown as WorldRing)))) return true;
    if (previousParts.some(part => pointInWorldRing(x, z, part.ring) &&
      !part.holes.some(hole => pointInWorldRing(x, z, hole)))) return true;
  }
  return false;
}

export function gendarmenmarktPerimeterRoofAt(building: typeof source.buildings[number], x: number, z: number): number | null {
  let top: number | null = null;
  for (const part of building.officialParts) {
    const y = bebelplatzPartRoofAt(part, x, z);
    if (y !== null) top = Math.max(top ?? -Infinity, y + building.displayYTranslationM);
  }
  return top;
}
