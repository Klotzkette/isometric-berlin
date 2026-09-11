import source from "./gendarmenmarktSource.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
import { bebelplatzPartBounds, bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";

export type GendarmenmarktPart = BebelplatzSourcePart;
export const GENDARMENMARKT_SOURCES = Object.values(source.profiles);
export const GENDARMENMARKT_PRISM_IDS = new Set(GENDARMENMARKT_SOURCES.flatMap(p => p.replaced_prism_ids));
export const GENDARMENMARKT_GROUP_NAME = "Gendarmenmarkt official church and theatre envelopes";
export const MINECRAFT_GENDARMENMARKT_GROUP_NAME = "Block-native Gendarmenmarkt envelopes";
export const gendarmenmarktPartBounds = bebelplatzPartBounds;
export const gendarmenmarktPartContains = bebelplatzPartContains;
export const GENDARMENMARKT_PROFILE = {
  frenchTower: { centre: [1409.825, 531.98], topY: 66.56, sourceParent: "DEBE01YYK00000sJ" },
  germanTower: { centre: [1424.965, 716.395], topY: 68.206, sourceParent: "DEBE01YYK000085g" },
  konzerthaus: { frontCentre: [1393.264, 619.846], porticoColumns: 6, stairTreads: 29 },
  domePorticos: 3, columnsPerDomePortico: 6, columnsPerDrum: 12,
  squareOsmKey: "way/844740667", schillerOsmKey: "node/262457570",
  groundY: 5.2, bearingRadians: .075,
  sourceGeometryStatus: "Exact official envelopes; architectural subdivisions, colour shades and figure anatomy are non-surveyed recognition geometry.",
  textureFree: true, catalogueAddition: false,
} as const;

export function gendarmenmarktSourceForPrism(id: string) {
  return GENDARMENMARKT_SOURCES.find(p => p.replaced_prism_ids.includes(id));
}
export function gendarmenmarktPartRoofAt(part: GendarmenmarktPart, x: number, z: number): number | null {
  const profile = GENDARMENMARKT_SOURCES.find(p => p.parts.some(v => v.id === part.id));
  const tower = profile?.parent_id === GENDARMENMARKT_PROFILE.frenchTower.sourceParent ? GENDARMENMARKT_PROFILE.frenchTower
    : profile?.parent_id === GENDARMENMARKT_PROFILE.germanTower.sourceParent ? GENDARMENMARKT_PROFILE.germanTower : null;
  if (tower) {
    if (!bebelplatzPartContains(part, x, z)) return null;
    const dx = x - tower.centre[0], dz = z - tower.centre[1], radius = Math.hypot(dx, dz);
    if (radius <= 9.225) return 44.95 + (tower.topY - 3.65 - 44.95) * Math.sqrt(Math.max(0, 1 - radius ** 2 / 9.225 ** 2));
    if (radius <= 10.8) return 44.975;
    const angle = GENDARMENMARKT_PROFILE.bearingRadians;
    const u = dx * Math.cos(angle) - dz * Math.sin(angle), v = dx * Math.sin(angle) + dz * Math.cos(angle);
    if (Math.abs(u) <= 12.25 && Math.abs(v) <= 12.25) return 28;
    const across = u > 12.25 ? Math.abs(v) : Math.abs(u);
    return 22 + 3 * Math.max(0, 1 - across / 9.65);
  }
  const y = bebelplatzPartRoofAt(part, x, z);
  return y === null ? null : y + (profile?.display_y_translation_m ?? 0);
}
/** Remove only the retained footprint columns when the authored counterpart is present. */
export function isGendarmenmarktReplacementColumn(x: number, z: number): boolean {
  if (x < 1339 || x > 1446 || z < 510 || z > 740) return false;
  return GENDARMENMARKT_SOURCES.some(p => p.parts.some(v => bebelplatzPartContains(v, x, z)) ||
    p.previous_display_prisms.some(v => pointInWorldRing(x * 10, z * 10, v.ring as unknown as WorldRing) &&
      !v.holes.some(h => pointInWorldRing(x * 10, z * 10, h as unknown as WorldRing))));
}
