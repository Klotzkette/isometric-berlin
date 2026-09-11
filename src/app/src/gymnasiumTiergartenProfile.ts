import source from "./gymnasiumTiergartenSource.json";
import {
  bebelplatzPartContains,
  bebelplatzPartRoofAt,
  type BebelplatzSourcePart,
} from "./bebelplatzBuildingProfile";

export const GYMNASIUM_NEUBAU_SOURCE = source;
export const GYMNASIUM_NEUBAU_PRISM_IDS = new Set(source.replaced_prism_ids);
export const GYMNASIUM_AULA_IDS = new Set(["ruAxvlwz", "neNfHjtD", "lnB9I8b8"]);
export const GYMNASIUM_NEUBAU_PARTS: BebelplatzSourcePart[] = source.parts.map(
  (part) => ({
    ...part,
    ground_y_m: part.ground_y_m + source.display_y_translation_m,
    top_y_m: part.top_y_m + source.display_y_translation_m,
    surfaces: part.surfaces.map((s) => ({
      ...s,
      rings: s.rings.map((r) =>
        r.map(([x, y, z]) => [x, y + source.display_y_translation_m, z]),
      ),
    })),
  }),
);
const PARTS = new Map(GYMNASIUM_NEUBAU_PARTS.map((p) => [p.id.slice(-8), p]));
export function gymnasiumNeubauPartForPrism(
  id: string,
): BebelplatzSourcePart | undefined {
  return PARTS.get(id);
}
export function gymnasiumNeubauRoofAt(
  part: BebelplatzSourcePart,
  x: number,
  z: number,
): number | null {
  return bebelplatzPartRoofAt(part, x, z);
}
export function isGymnasiumNeubauReplacementColumn(
  x: number,
  z: number,
): boolean {
  return (
    x > -2180 &&
    x < -2131 &&
    z > -148 &&
    z < -89 &&
    GYMNASIUM_NEUBAU_PARTS.some((p) => bebelplatzPartContains(p, x, z))
  );
}
export const HAND_MIT_UHR_PROFILE = {
  osmKey: "node/5140418371",
  world: [-2147.5, 5.2, -78.7] as const,
  artist: "Joachim Schmettau",
  year: 1975,
  displayHeightM: 4.5,
  publishedHeightAlternativesM: [4.5, 5.5],
  heightIsSurveyed: false,
  localYawRadians: -0.41,
  schoolSource: "https://gymnasium-tiergarten.de/schule/gebaeude/",
  associationSource: "https://hansaviertel.berlin/interbau-1957/kunst/",
} as const;
/** Only the represented narrow plinth/hand, never a whole forecourt blocker. */
export function handMitUhrSolidAt(
  x: number,
  y: number,
  z: number,
  radius = 0,
): boolean {
  const p = HAND_MIT_UHR_PROFILE;
  return (
    y >= p.world[1] &&
    y < p.world[1] + p.displayHeightM &&
    Math.hypot(x - p.world[0], z - p.world[2]) < 0.95 + radius
  );
}
