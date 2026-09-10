/**
 * Additive resolution of the H3 source overlap. The delivered main footprint
 * blankets three lower courtyard roofs. Their surrounding high part provides
 * the inner wall vertices below; all source records remain unchanged.
 */
export const HUMBOLDTHAFEN_H3_COURTYARD_PROFILE = {
  mainId: "ee9JgIcN",
  enclosingPartId: "WeZM0Chn",
  lowerRoofIds: ["fMIvAwPW", "U8FpiULv", "OOUdyXFj"],
  // Decimetres in the committed viewer frame, copied from the enclosing part.
  ring: [
    [601, -8745], [605, -8911], [629, -8922], [628, -8911],
    [762, -8975], [766, -8977], [767, -8988], [802, -9005],
    [797, -8741],
  ],
  source: "https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5820.zip",
  verification: "Berlin DOP 2025 spring orthophoto, checked 2026-09-10",
  resolution: "Retain the outer LoD2 envelope and its height, expose the three lower source roof parts inside the measured upper courtyard wall; do not treat the courtyard as a hole through the ground storeys.",
} as const;

type HarbourFootprint = { id: string; holes?: number[][][] };
const resolved = new WeakMap<HarbourFootprint, HarbourFootprint>();

/** Return the presentation footprint without mutating the delivered record. */
export function resolveHumboldthafenPrism<T extends HarbourFootprint>(prism: T): T {
  if (prism.id !== HUMBOLDTHAFEN_H3_COURTYARD_PROFILE.mainId) return prism;
  const cached = resolved.get(prism);
  if (cached) return cached as T;
  const ring = HUMBOLDTHAFEN_H3_COURTYARD_PROFILE.ring;
  if (prism.holes?.some(hole => hole.length === ring.length &&
    hole.every(([x, z], index) => x === ring[index][0] && z === ring[index][1]))) {
    resolved.set(prism, prism);
    return prism;
  }
  const copy = {
    ...prism,
    holes: [
      ...(prism.holes ?? []),
      ring.map(([x, z]) => [x, z]),
    ],
  };
  resolved.set(prism, copy);
  // Geometry and collision paths may resolve an already-resolved record.
  resolved.set(copy, copy);
  return copy;
}
