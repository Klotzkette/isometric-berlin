import source from "./spreeRecognitionSource.json";
import { pointInWorldRing, type WorldRing } from "./chancelleryExtensionProfile";
export { SPREE_RECOGNITION_PRISM_IDS } from "./spreeRecognitionIds";

export type SourcePart = {
  id: string;
  height_m: number;
  ground_y_m: number;
  top_y_m: number;
  ring: number[][];
  holes: number[][][];
  surfaces?: { kind: string; rings: number[][][] }[];
};

export const BODE_SOURCE = source.bode;
export const GRILL_SOURCE = source.grill;
export const BODE_MAIN = BODE_SOURCE.parts.find((p) => p.id === "DEBE3DBjgh4JboMO")!;
export const BODE_DOMES = BODE_SOURCE.parts.filter((p) => !p.surfaces);
export const SPREE_RECOGNITION_GROUP_NAME = "Source-bound Bode-Museum and Grill Royal";
export const MINECRAFT_SPREE_RECOGNITION_GROUP_NAME = "Block-native Bode-Museum and Grill Royal";
export const SPREE_RECOGNITION_FINE_LAYER_NAME = "Spree museum and restaurant carved detail";

export const SPREE_RECOGNITION_PROFILE = {
  name: SPREE_RECOGNITION_GROUP_NAME,
  sourceCreated: "2026-03-02",
  sourceUrls: [
    BODE_SOURCE.source_url,
    GRILL_SOURCE.source_url,
    "https://www.openstreetmap.org/relation/4211594",
    "https://www.openstreetmap.org/node/2884321484",
    "https://www.openstreetmap.org/way/105733634",
    "https://www.berlin.de/landesdenkmalamt/welterbe/museumsinsel-berlin/bode-museum-654566.php",
    "https://www.museumsinsel-berlin.de/gebaeude/bode-museum/",
    "https://www.grillroyal.com/",
  ],
  bode: {
    name: "Bode-Museum",
    osmKey: "relation/4211594",
    lod2Parent: BODE_SOURCE.parent_id,
    courtyardCount: 5,
    greatDomeHeightM: 48.7,
    smallDomeHeightM: 37.827,
    mainEnvelopeHeightM: 25.48,
    focus: [1591, 20, -283],
  },
  grill: {
    name: "Grill Royal / Riverside",
    osmKey: "node/2884321484",
    osmBuildingKey: "way/105733634",
    lod2Parent: GRILL_SOURCE.parent_id,
    address: "Friedrichstrasse 105B, Berlin",
    anchorWorldM: [1162.071, 4.202, -382.209],
    sourceHeightM: 31.555,
    focus: [1167, 17, -398],
  },
  geometryStatus:
    "Complete source-bound replacement of the old OSM display prisms and clipped Grill LoD2 fragments. Official 2026 LoD2 fixes all twelve parts, plan, five museum courts and height envelopes; facade orders, balustrades, dome curvature/ribs, dormers, terrace furnishings and signs are non-surveyed procedural subdivisions. No source photograph, texture or hidden duplicate shell is loaded.",
  textureFree: true,
  catalogueAddition: false,
} as const;

export function sourcePartContains(part: SourcePart, x: number, z: number): boolean {
  return (
    pointInWorldRing(x, z, part.ring as unknown as WorldRing) &&
    !part.holes.some((hole) => pointInWorldRing(x, z, hole as unknown as WorldRing))
  );
}

export function sourcePartBounds(part: SourcePart): [number, number, number, number] {
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const [x, z] of part.ring) {
    minX = Math.min(minX, x);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxZ = Math.max(maxZ, z);
  }
  return [minX, minZ, maxX, maxZ];
}

/** Exact building masks, not a district-radius filter that swallows neighbours. */
export function isSpreeRecognitionReplacementColumn(x: number, z: number): boolean {
  if (x >= 1534 && x <= 1681 && z >= -325 && z <= -219)
    return BODE_SOURCE.parts.some((part) => sourcePartContains(part, x, z));
  if (x >= 1140 && x <= 1196 && z >= -426 && z <= -385)
    return GRILL_SOURCE.parts.some((part) => sourcePartContains(part, x, z));
  return false;
}
