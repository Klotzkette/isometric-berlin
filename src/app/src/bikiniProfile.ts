import source from "./bikiniSource.json";

export const BIKINI_SOURCE = source;
export const BIKINI_GROUP = "Bikini Berlin source-bound architecture";
export const BIKINI_NATIVE_GROUP = "Block-native Bikini Berlin architecture";
export const BIKINI_REPLACEMENT_IDS = new Set(source.replacementPrismIds);
export type BikiniPart = {
  id: string; ring: number[][]; holes: number[][][]; renderRoofHoles: number[][][];
  bottom: number; top: number; material: string; roofMaterial: string; kind: string;
  steps: { ring: number[][]; bottom: number; top: number }[];
};
/** The explicit staircase supersedes the mall's otherwise closed upper cap. */
export const BIKINI_DISPLAY_PARTS: readonly BikiniPart[] = source.parts.flatMap((part): BikiniPart[] => {
  if (part.id !== "364457308") return [part];
  const stairs = source.parts.find(p => p.id === "364457329")!;
  return [
    { ...part, top: stairs.bottom },
    { ...part, bottom: stairs.bottom, holes: [...part.holes, stairs.ring] },
  ];
});
export const BIKINI_PROFILE = {
  sourceParentId: "OSM-way-364457341",
  upperSlabId: "364457336",
  openStoreyId: "364457330",
  roofSetbackId: "364457331",
  facadeBayPitchM: 5.77,
  facadeStatus: "Source part edges and mapped heights; window subdivisions, colours, railings and signs are procedural recognition detail, not a measured facade survey",
  sources: [
    "https://www.openstreetmap.org/way/364457341",
    "https://www.bikiniberlin.de/en/press-kit/architecture/",
    "https://www.hildundk.de/projekte/bikini-berlin-2/",
    "https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/bikinihaus-641010.php",
  ],
} as const;

/** Exact owner cells only; mixed/unknown cells retain their source geometry. */
const owned = new Set([...source.native.safeWholeCells, ...source.native.exclusiveOccupiedCells].map(([x, z]) => `${x},${z}`));
export function isBikiniReplacementCell(x: number, z: number, size: number): boolean {
  const step = source.native.cellSizeM;
  if (![x, z, size].every(Number.isFinite) || size <= 0 || x % step !== 0 || z % step !== 0 || size % step !== 0) return false;
  for (let dx = 0; dx < size; dx += step) for (let dz = 0; dz < size; dz += step) {
    if (!owned.has(`${x + dx},${z + dz}`)) return false;
  }
  return true;
}
