import source from "./behren42Source.json";
import { bebelplatzPartContains, bebelplatzPartRoofAt } from "./bebelplatzBuildingProfile";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const BEHREN42_SOURCE = source;
export const BEHREN42_PRISM_IDS = new Set(source.replaced_prism_ids);
export const BEHREN42_GROUP_NAME = "Humboldt Carre Behrenstrasse 42 source architecture";
export const MINECRAFT_BEHREN42_GROUP_NAME = "Block-native Humboldt Carre Behrenstrasse 42";
export const BEHREN42_PROFILE = {
  address: "Behrenstraße 42", occupant: "Hengeler Mueller", lod2Parent: source.parent_id,
  groundY: 5.2, stoneTopY: 28.617, topY: 36.519,
  south: { start: [1318.09, 365.907], end: [1414.314, 358.249], side: -1 },
  west: { start: [1316.023, 347.765], end: [1318.09, 365.907], side: -1 },
  upperSouth: { start: [1319.365, 364.614], end: [1414.368, 357.023], side: -1 },
  upperWest: { start: [1317.992, 347.43], end: [1319.365, 364.614], side: -1 },
  southBays: 25, westBays: 5, historicRegisters: 4, glazedUpperRegisters: 2,
  textureFree: true, photographsBundled: false, catalogueAddition: false,
  geometryStatus: "Exact retained LoD2 walls and roofs; local facade bays and upper glazing subdivisions are procedural, not surveyed.",
} as const;

const previous = source.previous_display_prisms.map((p) => ({
  ring: p.ring.map(([x, z]) => [x / 10, z / 10]) as WorldRing,
}));

export function isBehren42ReplacementColumn(x: number, z: number): boolean {
  if (x < 1315 || x > 1416 || z < 299 || z > 367) return false;
  return previous.some(p => pointInWorldRing(x, z, p.ring)) ||
    source.parts.some(p => bebelplatzPartContains(p, x, z));
}

export function behren42RoofAt(x: number, z: number): number | null {
  let result: number | null = null;
  for (const part of source.parts) {
    const height = bebelplatzPartRoofAt(part, x, z);
    if (height !== null) result = Math.max(result ?? -Infinity, height + source.display_y_translation_m);
  }
  return result;
}
