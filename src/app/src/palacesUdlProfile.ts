import source from "./palacesUdlSource.json";
import { bebelplatzPartContains, bebelplatzPartRoofAt, type BebelplatzSourcePart } from "./bebelplatzBuildingProfile";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";

export const PALACES_UDL_SOURCES = Object.values(source.profiles);
export const PALACES_UDL_PRISM_IDS = new Set(PALACES_UDL_SOURCES.flatMap(p => p.replaced_prism_ids));
export const PALACES_UDL_GROUP_NAME = "Eastern Unter den Linden palais and Friedrich monument";
export const MINECRAFT_PALACES_UDL_GROUP_NAME = "Block-native eastern Unter den Linden palais and Friedrich monument";
export const PALACES_BRIDGE_ID = "DEBE3Dat7eRC0lD2";
export const PALACES_OPEN_COLONNADE_IDS = new Set(["DEBE3DtTJwLxtfvr", "DEBE3DiqJWtP1g11"]);
export const PALACES_PORTICO_ID = "DEBE01YYK0001yuk";
export const FRIEDRICH_MONUMENT_PROFILE = {
  osmKey: source.monument.osm_key, anchor: source.monument.world_anchor_m,
  groundY: 5.2, publishedOverallHeightM: 13.5, topY: 18.7,
  facing: [.995, -.099875] as const, fenceHalfWidthM: 3.4, fenceHalfLengthM: 4.9,
  lampStandards: 4, lampHalfWidthM: 4.25, lampHalfLengthM: 5.65,
  fenceHeightM: 1.35, principalEquestrianFigures: 1, cornerEquestrianFigures: 4,
  publishedDimensionSource: "https://bildhauerei-in-berlin.de/bildwerk/reiterstandbild-friedrich-der-grosse-5108/",
  monumentRecord: "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09060118",
  geometryStatus: "Exact retained OSM anchor and published 13.5 m total; all local horse, figure, socle and fence subdivisions are procedural display estimates.",
  catalogueAddition: false, textureFree: true,
} as const;
export function palacesUdlSourceForPrism(id: string) { return PALACES_UDL_SOURCES.find(p => (p.replaced_prism_ids as string[]).includes(id)); }
export const palacesUdlPartContains = bebelplatzPartContains;
export function palacesUdlPartRoofAt(part: BebelplatzSourcePart, x: number, z: number): number | null {
  const top = bebelplatzPartRoofAt(part, x, z);
  const profile = PALACES_UDL_SOURCES.find(p => p.parts.some(s => s.id === part.id));
  return top === null ? null : top + (profile?.display_y_translation_m ?? 0);
}
/** Source-bound passage clearance, shared by drawn walls, native walls and collision. */
export function palacesUdlPartBaseAt(part: BebelplatzSourcePart, x: number, z: number): number {
  if (part.id === PALACES_BRIDGE_ID) {
    const u = (x - 1686.65) * .995 + (z - 242.36) * -.099875;
    if (Math.abs(u) < 4.65) return 10.5 + 3.6 * Math.sqrt(Math.max(0, 1 - (u / 4.65) ** 2));
  }
  if (part.id === PALACES_PORTICO_ID || PALACES_OPEN_COLONNADE_IDS.has(part.id))
    return (palacesUdlPartRoofAt(part, x, z) ?? part.top_y_m) - .65;
  return 5.2;
}
export function isPalacesUdlReplacementColumn(x: number, z: number): boolean {
  if (x < 1660 || x > 1763 || z < 212 || z > 313) return false;
  return PALACES_UDL_SOURCES.some(p => p.parts.some(v => bebelplatzPartContains(v, x, z)) || p.previous_display_prisms.some(v =>
    pointInWorldRing(x * 10, z * 10, v.ring as unknown as WorldRing) && !v.holes.some(r => pointInWorldRing(x * 10, z * 10, r as unknown as WorldRing))));
}
export function friedrichMonumentLocal(x: number, z: number): [number, number] {
  const dx = x - FRIEDRICH_MONUMENT_PROFILE.anchor[0], dz = z - FRIEDRICH_MONUMENT_PROFILE.anchor[1];
  return [dx * .099875 + dz * .995, dx * .995 - dz * .099875];
}
/** Core and four narrow fence sides only; surrounding avenue is never a radial obstacle. */
export function friedrichMonumentSolidAt(x: number, z: number, footY: number, height = 1.8): boolean {
  const [u, v] = friedrichMonumentLocal(x, z), y = footY - 5.2;
  if (y + height <= 0 || y >= 13.5) return false;
  if (y < 5.3) for (const lu of [-4.25, 4.25]) for (const lv of [-5.65, 5.65]) if (Math.hypot(u - lu, v - lv) < .28) return true;
  if (Math.abs(u) < 2.48 && Math.abs(v) < 3.45 && y < 8.2) return true;
  return y < 1.5 && ((Math.abs(Math.abs(u) - 3.4) < .14 && Math.abs(v) < 5.04) ||
    (Math.abs(Math.abs(v) - 4.9) < .14 && Math.abs(u) < 3.54));
}

/** Authored load-bearing columns under the opened source-bound porch/colonnade. */
export function palacesUdlSupportSolidAt(x: number, z: number, footY: number, height = 1.8): boolean {
  if (footY + height <= 5.2) return false;
  for (let i = 0; i < 6; i++) if (footY < 19.5 && Math.hypot(x - (1706.05 + i * 1.94), z - (216.72 - i * .153)) < .47) return true;
  const ax = 1730.44, az = 219.443, dx = 1756.7 - ax, dz = 217.377 - az, l = Math.hypot(dx, dz);
  for (let i = 0; i <= 10; i++) {
    const cx = ax + dx * i / 10 - dz * .65 / l, cz = az + dz * i / 10 + dx * .65 / l;
    if (footY < 14.16 && Math.hypot(x - cx, z - cz) < .42) return true;
  }
  return false;
}

/** Point-clear void contract; the viewer samples its full walking capsule. */
export function palacesUdlWalkableAt(x: number, y: number, z: number, sourceId?: string): boolean {
  if (y < 5.2 || x < 1660 || x > 1763 || z < 212 || z > 313 || palacesUdlSupportSolidAt(x, z, y, .01)) return false;
  const parts = PALACES_UDL_SOURCES.flatMap(s => s.parts);
  const candidates = parts.filter(p => palacesUdlPartContains(p, x, z));
  const sourceMatches = !sourceId || candidates.some(p => p.id === sourceId || p.id.endsWith(sourceId)) ||
    PALACES_UDL_SOURCES.some(s => (s.replaced_prism_ids as string[]).includes(sourceId) && s.parts.some(p => candidates.includes(p)));
  if (!sourceMatches) return false;
  const opening = candidates.some(p =>
    (p.id === PALACES_BRIDGE_ID || p.id === PALACES_PORTICO_ID || PALACES_OPEN_COLONNADE_IDS.has(p.id)) && y < palacesUdlPartBaseAt(p, x, z));
  if (!opening) return false;
  return !candidates.some(p => y >= palacesUdlPartBaseAt(p, x, z) && y <= (palacesUdlPartRoofAt(p, x, z) ?? -Infinity));
}
