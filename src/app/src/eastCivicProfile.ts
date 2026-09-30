import source from "./eastCivicSource.json";
import { bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
export const EAST_CIVIC_SOURCES = Object.values(source.profiles);
export const EAST_CIVIC_PRISM_IDS = new Set(EAST_CIVIC_SOURCES.flatMap(s => s.replaced_prism_ids));
export const EAST_CIVIC_GROUP_NAME = "Friedrichswerder church and Foreign Office architecture";
export const MINECRAFT_EAST_CIVIC_GROUP_NAME = "Block-native Friedrichswerder church and Foreign Office architecture";
export const EAST_CIVIC_OPEN_CANOPY_IDS = new Set(["DEBE01YYK0001xuZ", "DEBE3DsRd9T01uJe"]);
export const EAST_CIVIC_GLASS_PART_IDS = new Set(["DEBE00YY1Mk000Kv", "DEBE3DJrlFgy3FFk"]);
export const FRIEDRICHSWERDER_TOWER_IDS = ["DEBE3DyLqyvesbrt", "DEBE3DwNDmqAIY6r"] as const;
const NEW_MAIN_ID = "DEBE3DYaStnJ2Nlk";
const glassAtrium = EAST_CIVIC_SOURCES[1].parts.find(p => p.id === "DEBE3DJrlFgy3FFk")!;
const eastLoggia = EAST_CIVIC_SOURCES[1].parts.find(p => p.id === "DEBE01YYK0001xuZ")!;
export function eastCivicPartContains(part: BebelplatzSourcePart, x:number, z:number):boolean {
 return bebelplatzPartContains(part,x,z) && !(part.id === NEW_MAIN_ID && bebelplatzPartContains(glassAtrium,x,z));
}
export function eastCivicPartRoofAt(part:BebelplatzSourcePart,x:number,z:number):number|null {
 return eastCivicPartContains(part,x,z) ? bebelplatzPartRoofAt(part,x,z) : null;
}
export function eastCivicSourceForPrism(id: string) { return EAST_CIVIC_SOURCES.find(s => (s.replaced_prism_ids as string[]).includes(id)); }
export function eastCivicPartBaseAt(part: BebelplatzSourcePart,x?:number,z?:number): number {
 if(part.id === NEW_MAIN_ID && x!==undefined && z!==undefined && bebelplatzPartContains(eastLoggia,x,z))return eastLoggia.top_y_m-.9;
 return EAST_CIVIC_OPEN_CANOPY_IDS.has(part.id) ? part.top_y_m - .9 : Math.max(5.2, part.ground_y_m);
}
export function isEastCivicReplacementColumn(x: number, z: number): boolean {
  if (x < 1740 || x > 2075 || z < 340 || z > 780) return false;
  return EAST_CIVIC_SOURCES.some(s => s.parts.some(p => bebelplatzPartContains(p, x, z)) || s.previous_display_prisms.some(p => pointInWorldRing(x * 10, z * 10, p.ring as unknown as WorldRing) && !p.holes.some(h => pointInWorldRing(x * 10, z * 10, h as unknown as WorldRing))));
}
/** Two represented posts under the eastern high loggia; procedural local dimensions. */
export const EAST_CIVIC_LOGGIA_POSTS = [[1910.22, 419.3], [1913.38, 428.92]] as const;
export function eastCivicSupportSolidAt(x: number, z: number, footY: number, height = 1.8): boolean {
  if (footY + height <= 5.2 || footY >= 27.5) return false;
  return EAST_CIVIC_LOGGIA_POSTS.some(([px, pz]) => Math.abs(x - px) < .68 && Math.abs(z - pz) < .68);
}
/** Point-clear contract; only documented source canopies open, remaining parts stay solid. */
export function eastCivicWalkableAt(x: number, y: number, z: number, sourceId?: string): boolean {
  if (x < 1790 || x > 1935 || z < 399 || z > 513 || y < 5.2 || eastCivicSupportSolidAt(x, z, y, .01)) return false;
  const candidates = EAST_CIVIC_SOURCES[1].parts.filter(p => bebelplatzPartContains(p, x, z));
  if (sourceId && !candidates.some(p => p.id === sourceId || p.id.endsWith(sourceId)) && !EAST_CIVIC_SOURCES[1].replaced_prism_ids.includes(sourceId)) return false;
  return candidates.some(p => EAST_CIVIC_OPEN_CANOPY_IDS.has(p.id) && y < eastCivicPartBaseAt(p,x,z)) && !candidates.some(p => y >= eastCivicPartBaseAt(p,x,z) && y <= (bebelplatzPartRoofAt(p, x, z) ?? -Infinity));
}
