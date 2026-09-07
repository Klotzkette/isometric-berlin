import source from "./buildingAttributeSource.json";

export type BuildingAttributes = {
  osm: string;
  part: boolean;
  tags: Partial<Record<string, string>>;
};

const sourceByPrism = source.prisms as Record<string, number>;
export const BUILDING_ATTRIBUTE_SOURCE = source;

/** Original mapped tags; no tags are inferred for an unmatched building. */
export function buildingAttributes(id: string): BuildingAttributes | undefined {
  const index = sourceByPrism[id];
  return index === undefined ? undefined : source.records[index];
}

// Semantic material tones are display colours, not measured colour samples.
// Explicit mapped colours win; existing authored landmark colours win in callers.
const MATERIAL_TONES: Record<string, number> = {
  brick: 0xb76f52,
  clinker: 0x995843,
  concrete: 0xcdcfca,
  copper: 0x709589,
  glass: 0xb6d1d5,
  granite: 0xb0aca5,
  limestone: 0xe1d8be,
  metal: 0xb2bdbe,
  plaster: 0xe6dfcc,
  roof_tiles: 0xae7560,
  sandstone: 0xd9c8a4,
  slate: 0x79868c,
  steel: 0xadb9bd,
  stone: 0xc9c3b1,
  tiles: 0xae7560,
  titanium_zinc: 0xa5b4b5,
  wood: 0xab8b62,
  zinc: 0xa5b4b5,
};
const ROOF_MATERIAL_TONES: Record<string, number> = {
  ...MATERIAL_TONES,
  bitumen: 0x686e6d,
  concrete: 0xb3b4aa,
  glass: 0x98c3cd,
  grass: 0x9aa987,
  gravel: 0xc6beaa,
  tar_paper: 0x686e6d,
};
const NAMED_COLORS: Record<string, number> = {
  beige: 0xd9cfaf,
  black: 0x464b4e,
  blue: 0x7195ba,
  brown: 0x967256,
  cream: 0xf1e7ce,
  darkgrey: 0x737b7e,
  gray: 0xa5aaa9,
  green: 0x82997f,
  grey: 0xa5aaa9,
  lightgrey: 0xcdcfca,
  orange: 0xd9975c,
  red: 0xbb6b53,
  silver: 0xc3cdce,
  white: 0xeeeae0,
  yellow: 0xe6ce85,
};

/** Strict single colours only; mixed, unknown and free-text values are unresolved. */
export function mappedColor(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(cleaned)) return Number.parseInt(cleaned.slice(1), 16);
  if (/^#[0-9a-f]{3}$/.test(cleaned)) {
    return Number.parseInt(cleaned.slice(1).split("").map((v) => v + v).join(""), 16);
  }
  return NAMED_COLORS[cleaned];
}

export function mappedFacadeTone(attributes: BuildingAttributes | undefined): number | undefined {
  if (!attributes) return undefined;
  return mappedColor(attributes.tags["building:colour"]) ?? MATERIAL_TONES[attributes.tags["building:material"] ?? ""];
}

export function mappedRoofTone(attributes: BuildingAttributes | undefined): number | undefined {
  if (!attributes) return undefined;
  return mappedColor(attributes.tags["roof:colour"]) ?? ROOF_MATERIAL_TONES[attributes.tags["roof:material"] ?? ""];
}

/** Explicit mapped cladding resolves office-function ≠ curtain-glass assumptions. */
export function mappedGlazing(attributes: BuildingAttributes | undefined): boolean | undefined {
  const material = attributes?.tags["building:material"];
  if (!material || MATERIAL_TONES[material] === undefined) return undefined;
  return material === "glass";
}

export type MappedStoreyProfile = {
  count: number;
  floorPitch: number;
  height: number;
  sillStart: number;
};

/**
 * Honour recorded above-ground storeys only when they fit the retained envelope.
 * The count is source evidence. Equal subdivision/pane height are display rhythm;
 * unusual-height halls and partial elevated volumes deliberately stay unresolved.
 */
export function mappedStoreyProfile(
  attributes: BuildingAttributes | undefined,
  bodyHeightM: number,
): MappedStoreyProfile | null {
  const raw = attributes?.tags["building:levels"];
  if (!raw || !/^\d{1,2}$/.test(raw)) return null;
  if (attributes?.tags["building:min_level"] && attributes.tags["building:min_level"] !== "0") return null;
  const count = Number(raw);
  if (count < 1 || count > 40 || !Number.isFinite(bodyHeightM)) return null;
  const floorPitch = bodyHeightM / count;
  if (floorPitch < 2.3 || floorPitch > 5.5) return null;
  const sillStart = Math.min(1.05, floorPitch * 0.28);
  const height = Math.min(2.3, floorPitch - sillStart - 0.65);
  return { count, floorPitch, height, sillStart };
}
