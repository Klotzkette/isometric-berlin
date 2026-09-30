import source from "./dhmSource.json";
import { bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const DHM_SOURCE = source;
export const DHM_GROUP_NAME = "Deutsches Historisches Museum Zeughaus and transparent Pei architecture";
export const MINECRAFT_DHM_GROUP_NAME = "Block-native Deutsches Historisches Museum and Pei spiral";
export const DHM_PRISM_IDS = new Set(Object.values(source.profiles).flatMap(p => p.replaced_prism_ids));
export const DHM_PARTS: BebelplatzSourcePart[] = Object.values(source.profiles).flatMap(p => p.parts);
export const DHM_GLASS_PART_IDS = new Set(["DEBE3DFw5k86zVJB", "DEBE3De1XccDSz8G"]);
export const DHM_COURTYARD_ROOF_ID = "DEBE01AL53j00006";
export const DHM_PROFILE = {
  spiralCenter: [1686.2765, 69.0705],
  spiralRadius: 3.72,
  spiralInnerRadius: 1.65,
  spiralBottomY: 8.45,
  spiralTopY: 21.8,
  spiralTurns: 1.45,
  spiralTreadCount: 108,
  spiralTopSourceY: 22.649,
  sourcePartCount: 11,
  glassOpacity: 0.16,
  frontAxis: [[1688.464, 175.768], [1777.612, 168.041]],
  sourceUrls: [
    "https://www.dhm.de/museum/geschichte-und-architektur/architektur/",
    "https://eller-eller.de/portfolio/deutsches-historisches-museum-berlin/",
    "https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/zeughaus-deutsches-historisches-museum-641128.php",
  ],
  textureFree: true,
  hiddenSolidInfill: false,
} as const;

const previous = Object.values(source.profiles).flatMap(p => p.previous_display_prisms)
  .map(p => ({ ring: p.ring.map(([x, z]) => [x / 10, z / 10]) as WorldRing,
    holes: (p.holes as number[][][]).map(r => r.map(([x, z]) => [x / 10, z / 10]) as WorldRing) }));

/** Only the complete source and replaced exact old footprints own voxel columns. */
export function isDhmReplacementColumn(x: number, z: number): boolean {
  if (x < 1675 || x > 1781 || z < 22 || z > 179) return false;
  return previous.some(p => pointInWorldRing(x, z, p.ring) &&
    !p.holes.some(r => pointInWorldRing(x, z, r))) ||
    DHM_PARTS.some(p => bebelplatzPartContains(p, x, z));
}

/** Roof-only courtyard canopy must not turn its entire interior into a wall. */
export function dhmPartBaseAt(part: BebelplatzSourcePart): number {
  return part.id === DHM_COURTYARD_ROOF_ID ? 25.374 : part.ground_y_m;
}

export function dhmPartRoofAt(part: BebelplatzSourcePart, x: number, z: number): number | null {
  return bebelplatzPartRoofAt(part, x, z);
}

/** Exterior glass remains a building boundary; courtyard below canopy stays open. */
export function dhmWalkableAt(x: number, y: number, z: number, sourceId?: string): boolean {
  if (sourceId && sourceId !== DHM_COURTYARD_ROOF_ID) return false;
  const p = source.profiles.courtyardRoof.parts[0];
  return y < 25.15 && bebelplatzPartContains(p, x, z) &&
    !bebelplatzPartContains(source.profiles.zeughaus.parts[0], x, z);
}

/** Shared stair centreline retained for geometric tests and future interior navigation. */
export function dhmSpiralTread(t: number): { x: number; y: number; z: number; angle: number } {
  const angle = -0.15 + Math.PI * 2 * DHM_PROFILE.spiralTurns * t;
  const r = (DHM_PROFILE.spiralRadius + DHM_PROFILE.spiralInnerRadius) / 2;
  return { x: DHM_PROFILE.spiralCenter[0] + Math.cos(angle) * r,
    y: DHM_PROFILE.spiralBottomY + t * (DHM_PROFILE.spiralTopY - DHM_PROFILE.spiralBottomY),
    z: DHM_PROFILE.spiralCenter[1] + Math.sin(angle) * r, angle };
}
