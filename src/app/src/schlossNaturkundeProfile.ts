import source from "./schlossNaturkundeSource.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
import {
  bebelplatzPartBounds, bebelplatzPartContains, bebelplatzPartRoofAt,
  type BebelplatzSourcePart,
} from "./bebelplatzBuildingProfile";

export type SchlossNaturkundePart = BebelplatzSourcePart;
export const SCHLOSS_NATURKUNDE_SOURCES = Object.values(source.profiles);
export const SCHLOSS_NATURKUNDE_PRISM_IDS = new Set(
  SCHLOSS_NATURKUNDE_SOURCES.flatMap((p) => p.replaced_prism_ids),
);
export const SCHLOSS_NATURKUNDE_GROUP_NAME = "Official Schloss and Naturkunde envelopes";
export const MINECRAFT_SCHLOSS_NATURKUNDE_GROUP_NAME = "Block-native Schloss and Naturkunde envelopes";
export const schlossNaturkundePartBounds = bebelplatzPartBounds;
export const schlossNaturkundePartContains = bebelplatzPartContains;

export function schlossNaturkundeSourceForPrism(id: string) {
  return SCHLOSS_NATURKUNDE_SOURCES.find((p) => p.replaced_prism_ids.includes(id));
}
export function schlossNaturkundePartRoofAt(part: SchlossNaturkundePart, x: number, z: number): number | null {
  if (part.id === "DEBE3DzLpp1avSfB") {
    if (!schlossNaturkundePartContains(part, x, z)) return null;
    // The source's tall extruded perimeter and fan roof are retained evidence.
    // Curved copper subdivision is fitted inside the same measured plan/top.
    const r2 = ((x - 1979.43) ** 2 + (z - 278) ** 2) / 11.8 ** 2;
    return 47.2 + 17.67 * Math.sqrt(Math.max(0, 1 - r2));
  }
  const y = bebelplatzPartRoofAt(part, x, z);
  if (y === null) return null;
  const profile = SCHLOSS_NATURKUNDE_SOURCES.find((p) => p.parts.some((v) => v.id === part.id));
  return y + (profile?.display_y_translation_m ?? 0);
}

/** Exact original/official footprints, including open courts; no radial replacement. */
export function isSchlossNaturkundeReplacementColumn(x: number, z: number): boolean {
  if (!((x >= 1935 && x <= 2150 && z >= 130 && z <= 333) ||
        (x >= 460 && x <= 616 && z >= -1380 && z <= -1208))) return false;
  return SCHLOSS_NATURKUNDE_SOURCES.some((profile) =>
    profile.parts.some((part) => schlossNaturkundePartContains(part, x, z)) ||
    profile.previous_display_prisms.some((part) =>
      pointInWorldRing(x * 10, z * 10, part.ring as unknown as WorldRing) &&
      !part.holes.some((ring) => pointInWorldRing(x * 10, z * 10, ring as unknown as WorldRing))),
  );
}
